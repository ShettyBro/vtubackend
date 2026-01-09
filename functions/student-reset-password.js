

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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
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
    const body = JSON.parse(event.body || '{}');
    const { usn, token, new_password } = body;

    if (!usn || typeof usn !== 'string' || !usn.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'USN is required' }),
      };
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token is required' }),
      };
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'New password must be at least 8 characters' }),
      };
    }

    const normalizedUSN = usn.trim().toUpperCase();
    const providedToken = token.trim();

    pool = await sql.connect(dbConfig);

    const studentResult = await pool
      .request()
      .input('usn', sql.VarChar(50), normalizedUSN)
      .query(`
        SELECT 
          student_id, 
          is_active, 
          password_reset_token, 
          password_reset_expires
        FROM students
        WHERE usn = @usn
      `);

    if (studentResult.recordset.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    const student = studentResult.recordset[0];

    if (!student.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Account is inactive' }),
      };
    }

    if (!student.password_reset_token || !student.password_reset_expires) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    const tokenExpiry = new Date(student.password_reset_expires);
    const now = new Date();

    if (now > tokenExpiry) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token has expired' }),
      };
    }

    const tokenValid = await bcrypt.compare(providedToken, student.password_reset_token);

    if (!tokenValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    await pool
      .request()
      .input('student_id', sql.Int, student.student_id)
      .input('password_hash', sql.VarChar(255), newPasswordHash)
      .query(`
        UPDATE students
        SET 
          password_hash = @password_hash,
          password_reset_token = NULL,
          password_reset_expires = NULL
        WHERE student_id = @student_id
      `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Password reset successful. Please login again.',
      }),
    };
  } catch (error) {
    console.error('Error in student-reset-password:', error);

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

