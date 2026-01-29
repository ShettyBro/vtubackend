// reset-password.js
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const ALLOWED_ROLES = ['student', 'manager', 'principal', 'admin', 'subadmin'];

const getRoleTable = (role) => {
  if (role === 'student') return 'students';
  return 'users';
};

const getRoleIdColumn = (role) => {
  if (role === 'student') return 'student_id';
  return 'user_id';
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let pool;

  try {
    const path = event.path || event.rawPath || '';
    const role = path.split('/').pop();

    if (!ALLOWED_ROLES.includes(role)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid role' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { token, email, new_password } = body;

    // ✅ Validate token exists (required for both flows)
    if (!token || typeof token !== 'string' || !token.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token is required' }),
      };
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'New password must be at least 8 characters' }),
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const providedToken = token.trim();

    pool = await sql.connect(dbConfig);

    const tableName = getRoleTable(role);
    const idColumn = getRoleIdColumn(role);

    // ✅ Fetch user with force_password_reset flag (for users table only)
    let queryColumns = `${idColumn}, is_active, password_reset_token, password_reset_expires`;
    if (tableName === 'users') {
      queryColumns += ', force_password_reset';
    }

    const result = await pool
      .request()
      .input('email', sql.VarChar(255), normalizedEmail)
      .query(`
        SELECT ${queryColumns}
        FROM ${tableName}
        WHERE email = @email
      `);

    if (result.recordset.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    const user = result.recordset[0];

    // Check if account is active
    if (!user.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Account is inactive' }),
      };
    }

    // ✅ Validate token exists in database
    if (!user.password_reset_token || !user.password_reset_expires) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    // ✅ Check token expiry
    const tokenExpiry = new Date(user.password_reset_expires);
    const now = new Date();

    if (now > tokenExpiry) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token has expired' }),
      };
    }

    // ✅ Verify token matches (works for both forgot-password and forced reset)
    const tokenValid = await bcrypt.compare(providedToken, user.password_reset_token);

    if (!tokenValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    // ✅ Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // ✅ Update password and clear reset token
    // For users with force_password_reset flag, also set it to false
    let updateQuery = `
      UPDATE ${tableName}
      SET 
        password_hash = @password_hash,
        password_reset_token = NULL,
        password_reset_expires = NULL
    `;

    // ⚠️ CRITICAL: Clear force_password_reset flag after successful reset
    if (tableName === 'users' && user.force_password_reset) {
      updateQuery += ', force_password_reset = 0';
    }

    updateQuery += ` WHERE ${idColumn} = @id`;

    await pool
      .request()
      .input('id', sql.Int, user[idColumn])
      .input('password_hash', sql.VarChar(255), newPasswordHash)
      .query(updateQuery);

    // ✅ Success response (same for both flows)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Password reset successful. Please login again.',
      }),
    };
  } catch (error) {
    console.error('Error in reset-password:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'An error occurred processing your request',
      }),
    };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
};