const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SYSTEM_USER_ID = 1;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

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

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: "Method not allowed" }),
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

  const { usn, password } = body;

  if (!usn || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "USN and password are required" }),
    };
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const rateLimitCheck = await pool
      .request()
      .input("usn", sql.VarChar, usn)
      .input("lockout_duration", sql.Int, LOCKOUT_DURATION_MINUTES)
      .query(`
        SELECT 
          attempt_count,
          last_attempt_at,
          DATEDIFF(MINUTE, last_attempt_at, GETUTCDATE()) AS minutes_since_last
        FROM login_attempts
        WHERE identifier = @usn
          AND attempt_count >= ${MAX_LOGIN_ATTEMPTS}
          AND DATEDIFF(MINUTE, last_attempt_at, GETUTCDATE()) < @lockout_duration
      `);

    if (rateLimitCheck.recordset.length > 0) {
      const minutesRemaining = LOCKOUT_DURATION_MINUTES - rateLimitCheck.recordset[0].minutes_since_last;
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          message: `Too many login attempts. Please try again in ${minutesRemaining} minutes.`,
        }),
      };
    }

    const studentResult = await pool
      .request()
      .input("usn", sql.VarChar, usn)
      .query(`
        SELECT 
          student_id,
          college_id,
          full_name,
          usn,
          email,
          phone,
          password_hash,
          is_active
        FROM students
        WHERE usn = @usn
      `);

    if (studentResult.recordset.length === 0) {
      await pool
        .request()
        .input("usn", sql.VarChar, usn)
        .query(`
          IF EXISTS (SELECT 1 FROM login_attempts WHERE identifier = @usn)
          BEGIN
            UPDATE login_attempts
            SET attempt_count = attempt_count + 1,
                last_attempt_at = GETUTCDATE()
            WHERE identifier = @usn
          END
          ELSE
          BEGIN
            INSERT INTO login_attempts (identifier, attempt_count, last_attempt_at)
            VALUES (@usn, 1, GETUTCDATE())
          END
        `);

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid credentials" }),
      };
    }

    const student = studentResult.recordset[0];

    if (!student.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Account is inactive" }),
      };
    }

    const isMatch = await bcrypt.compare(password, student.password_hash);

    if (!isMatch) {
      await pool
        .request()
        .input("usn", sql.VarChar, usn)
        .query(`
          IF EXISTS (SELECT 1 FROM login_attempts WHERE identifier = @usn)
          BEGIN
            UPDATE login_attempts
            SET attempt_count = attempt_count + 1,
                last_attempt_at = GETUTCDATE()
            WHERE identifier = @usn
          END
          ELSE
          BEGIN
            INSERT INTO login_attempts (identifier, attempt_count, last_attempt_at)
            VALUES (@usn, 1, GETUTCDATE())
          END
        `);

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid credentials" }),
      };
    }

    await pool
      .request()
      .input("usn", sql.VarChar, usn)
      .query(`
        DELETE FROM login_attempts WHERE identifier = @usn
      `);

    await pool
      .request()
      .input("student_id", sql.Int, student.student_id)
      .query(`
        UPDATE students
        SET last_login_at = GETUTCDATE()
        WHERE student_id = @student_id
      `);

    await pool
      .request()
      .input("actor_user_id", sql.Int, SYSTEM_USER_ID)
      .input("actor_role", sql.VarChar, "SYSTEM_STUDENT_AUTH")
      .input("action_type", sql.VarChar, "STUDENT_LOGIN")
      .input("entity_type", sql.VarChar, "STUDENT")
      .input("entity_id", sql.Int, student.student_id)
      .input("description", sql.VarChar, `Student login: ${student.usn}`)
      .query(`
        INSERT INTO audit_logs (
          actor_user_id,
          actor_role,
          action_type,
          entity_type,
          entity_id,
          description
        )
        VALUES (
          @actor_user_id,
          @actor_role,
          @action_type,
          @entity_type,
          @entity_id,
          @description
        )
      `);

    const token = jwt.sign(
      {
        student_id: student.student_id,
        usn: student.usn,
        college_id: student.college_id,
        role: "STUDENT",
      },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Login successful",
        token,
      }),
    };
  } catch (err) {
    console.error("Student login error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
};