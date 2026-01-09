// student-forgot-password.js
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');

// ============================================================================
// SYSTEM USER ID - UPDATE THIS WITH YOUR ACTUAL SYSTEM USER ID FROM DATABASE
// ============================================================================
const SYSTEM_USER_ID = 1; // MUST exist in users table

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
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only accept POST
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
    const { email } = body;

    // Validate input
    if (!email || typeof email !== 'string' || !email.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Connect to database
    pool = await sql.connect(dbConfig);

    // Check if student exists and is active
    const studentResult = await pool
      .request()
      .input('email', sql.VarChar(255), normalizedEmail)
      .query(`
        SELECT student_id, full_name, email, is_active
        FROM students
        WHERE email = @email
      `);

    // SECURITY: Always return same response regardless of whether student exists
    const standardResponse = {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'If the account exists, a password reset link has been sent.',
      }),
    };

    // If student doesn't exist or is inactive, return success without doing anything
    if (studentResult.recordset.length === 0) {
      return standardResponse;
    }

    const student = studentResult.recordset[0];

    if (!student.is_active) {
      return standardResponse;
    }

    // Generate secure random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Hash the token
    const hashedToken = await bcrypt.hash(rawToken, 10);

    // Calculate expiry time
    const expiryTime = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Start transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Invalidate any existing reset tokens for this student
      await transaction
        .request()
        .input('student_id', sql.Int, student.student_id).query(`
          UPDATE students
          SET password_reset_token = NULL,
              password_reset_expires = NULL
          WHERE student_id = @student_id
        `);

      // Store hashed token and expiry
      await transaction
        .request()
        .input('student_id', sql.Int, student.student_id)
        .input('hashed_token', sql.VarChar(255), hashedToken)
        .input('expiry', sql.DateTime2, expiryTime).query(`
          UPDATE students
          SET password_reset_token = @hashed_token,
              password_reset_expires = @expiry
          WHERE student_id = @student_id
        `);

      // Commit transaction
      await transaction.commit();

      // Build reset link with raw token (not hashed)
      const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

      // Send email via Resend
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@vtufest.com',
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
      await transaction.rollback();
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