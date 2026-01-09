// student-forgot-password.js
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://yourapp.com';
const TOKEN_EXPIRY_MINUTES = 15;

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
  let transaction;

  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    const normalizedEmail = email.trim().toLowerCase();

    pool = await sql.connect(dbConfig);

    const studentResult = await pool
      .request()
      .input('email', sql.VarChar(255), normalizedEmail)
      .query(`
        SELECT student_id, full_name, email, is_active
        FROM students
        WHERE email = @email
      `);

    const standardResponse = {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'If the account exists, a password reset link has been sent.',
      }),
    };

    if (studentResult.recordset.length === 0) {
      return standardResponse;
    }

    const student = studentResult.recordset[0];

    if (!student.is_active) {
      return standardResponse;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiryTime = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await transaction
        .request()
        .input('student_id', sql.Int, student.student_id)
        .query(`
          UPDATE students
          SET password_reset_token = NULL,
              password_reset_expires = NULL
          WHERE student_id = @student_id
        `);

      await transaction
        .request()
        .input('student_id', sql.Int, student.student_id)
        .input('hashed_token', sql.VarChar(255), hashedToken)
        .input('expiry', sql.DateTime2, expiryTime)
        .query(`
          UPDATE students
          SET password_reset_token = @hashed_token,
              password_reset_expires = @expiry
          WHERE student_id = @student_id
        `);

      await transaction.commit();
      transaction = null;

      const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: student.email,
        subject: 'Password Reset Request - VTU Fest',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${student.full_name || 'Student'},</p>
          <p>You requested to reset your password. Click the link below to reset it:</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>This link will expire in ${TOKEN_EXPIRY_MINUTES} minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <br>
          <p>VTU Fest Team</p>
        `,
      });

      return standardResponse;
    } catch (txError) {
      if (transaction) {
        await transaction.rollback();
      }
      throw txError;
    }
  } catch (error) {
    console.error('Error in student-forgot-password:', error);

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