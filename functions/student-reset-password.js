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

    // DEBUG: Log incoming data
    console.log('USN:', usn);
    console.log('Token length:', token ? token.length : 0);
    console.log('Token (first 10 chars):', token ? token.substring(0, 10) : 'null');

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
      console.log('Student not found for USN:', normalizedUSN);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    const student = studentResult.recordset[0];

    // DEBUG: Log student data
    console.log('Student ID:', student.student_id);
    console.log('Is Active:', student.is_active);
    console.log('Has reset token:', !!student.password_reset_token);
    console.log('Token expires:', student.password_reset_expires);

    if (!student.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Account is inactive' }),
      };
    }

    if (!student.password_reset_token || !student.password_reset_expires) {
      console.log('No reset token found in database');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired reset token' }),
      };
    }

    const tokenExpiry = new Date(student.password_reset_expires);
    const now = new Date();

    console.log('Current time:', now.toISOString());
    console.log('Token expiry:', tokenExpiry.toISOString());
    console.log('Is expired:', now > tokenExpiry);

    if (now > tokenExpiry) {
      console.log('Token has expired');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token has expired' }),
      };
    }

    console.log('Comparing tokens...');
    const tokenValid = await bcrypt.compare(providedToken, student.password_reset_token);
    console.log('Token valid:', tokenValid);

    if (!tokenValid) {
      console.log('Token comparison failed');
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

    console.log('Password reset successful');

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