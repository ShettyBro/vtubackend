const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

const JWT_SECRET = process.env.JWT_SECRET;

// Default password hash for all new managers/principals
// Generated from: Test@1234
const DEFAULT_PASSWORD_HASH = '$2a$10$YourActualHashHere'; // ⚠️ REPLACE with actual hash from your script

// Valid roles mapping (frontend -> backend)
const VALID_ROLES = {
  student: 'STUDENT',
  principal: 'PRINCIPAL',
  manager: 'MANAGER',
  admin: 'ADMIN',
  sub_admin: 'SUB_ADMIN',
  volunteer_registration: 'VOLUNTEER_REGISTRATION',
  volunteer_helpdesk: 'VOLUNTEER_HELPDESK',
  volunteer_event: 'VOLUNTEER_EVENT',
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid JSON body" }),
    };
  }

  const { email, password, role } = body;

  // Validate required fields
  if (!email || !password || !role) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Email, password, and role are required" }),
    };
  }

  // Validate role
  const normalizedRole = VALID_ROLES[role.toLowerCase()];
  if (!normalizedRole) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid role specified" }),
    };
  }

  try {
    const pool = await sql.connect(dbConfig);

    // Route to appropriate login handler based on role
    if (normalizedRole === 'STUDENT') {
      return await handleStudentLogin(pool, email, password, headers);
    } else {
      return await handleUserLogin(pool, email, password, normalizedRole, headers);
    }

  } catch (err) {
    console.error("Login error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Server Re-booting.. try 1 min later" }),
    };
  }
};

// ============================================
// STUDENT LOGIN HANDLER
// ============================================
async function handleStudentLogin(pool, email, password, headers) {
  try {
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM students WHERE email = @email");

    if (result.recordset.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid Email or Password" }),
      };
    }

    const student = result.recordset[0];

    // Check if account is active
    if (!student.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Account is inactive" }),
      };
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, student.password_hash);

    if (!isMatch) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid Email or Password" }),
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        student_id: student.student_id,
        usn: student.usn,
        college_id: student.college_id,
        role: "STUDENT",
      },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    // Update last login
    await pool
      .request()
      .input("student_id", sql.Int, student.student_id)
      .query("UPDATE students SET last_login_at = GETUTCDATE() WHERE student_id = @student_id");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Login successful",
        token,
        role: "student",
        college_id: student.college_id,
        usn: student.usn,
        name: student.full_name,
      }),
    };
  } catch (err) {
    console.error("Student login error:", err);
    throw err;
  }
}

// ============================================
// USER LOGIN HANDLER (Principal, Manager, Admin, Volunteers)
// ============================================
async function handleUserLogin(pool, email, password, expectedRole, headers) {
  try {
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("role", sql.VarChar, expectedRole)
      .query("SELECT * FROM users WHERE email = @email AND role = @role");

    if (result.recordset.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid Email or Password" }),
      };
    }

    const user = result.recordset[0];

    // Check if account is active
    if (!user.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Account is inactive" }),
      };
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid Email or Password" }),
      };
    }

    // ⚠️ CRITICAL: Check if user is using default password AND has force_password_reset flag
    const isDefaultPassword = await bcrypt.compare(password, DEFAULT_PASSWORD_HASH);
    
    if (isDefaultPassword && user.force_password_reset) {
      // Generate a special 15-minute token for forced password reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedResetToken = await bcrypt.hash(resetToken, 10);
      const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token in database
      await pool
        .request()
        .input('user_id', sql.Int, user.user_id)
        .input('hashed_token', sql.VarChar(255), hashedResetToken)
        .input('expiry', sql.DateTime2, expiryTime)
        .query(`
          UPDATE users
          SET password_reset_token = @hashed_token,
              password_reset_expires = @expiry
          WHERE user_id = @user_id
        `);

      // ⚠️ DO NOT generate JWT session token
      // Return FORCE_RESET status with reset token for frontend redirect
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: "FORCE_RESET",
          message: "First-time login detected. Please reset your password.",
          reset_token: resetToken,
          email: user.email,
          role: expectedRole.toLowerCase().replace(/_/g, '_'),
        }),
      };
    }

    // ✅ Normal login flow continues (password is not default OR flag is false)
    
    // Generate JWT token payload based on role
    const tokenPayload = {
      user_id: user.user_id,
      full_name: user.full_name,
      role: expectedRole,
    };

    // Add college_id only for PRINCIPAL and MANAGER
    if (expectedRole === 'PRINCIPAL' || expectedRole === 'MANAGER') {
      tokenPayload.college_id = user.college_id;
    }

    // Generate JWT token
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "4h" });

    // Update last login
    await pool
      .request()
      .input("user_id", sql.Int, user.user_id)
      .query("UPDATE users SET last_login_at = GETUTCDATE() WHERE user_id = @user_id");

    // Prepare response data
    const responseData = {
      message: "Login successful",
      token,
      role: expectedRole.toLowerCase().replace(/_/g, '_'), // Keep underscore format for frontend
      name: user.full_name,
      user_id: user.user_id,
      college_id: user.college_id,
    };

    // Add college_id to response for PRINCIPAL and MANAGER
    if (user.college_id) {
      responseData.college_id = user.college_id;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData),
    };
  } catch (err) {
    console.error("User login error:", err);
    throw err;
  }
}