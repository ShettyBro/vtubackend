// forgot-password.js
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');

const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

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
  let transaction;

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
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const standardResponse = {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'If the account exists, a password reset link has been sent.',
      }),
    };

    pool = await sql.connect(dbConfig);

    const tableName = getRoleTable(role);
    const idColumn = getRoleIdColumn(role);

    const result = await pool
      .request()
      .input('email', sql.VarChar(255), normalizedEmail)
      .query(`
        SELECT ${idColumn}, full_name, email, is_active
        FROM ${tableName}
        WHERE email = @email
      `);

    if (result.recordset.length === 0) {
      return standardResponse;
    }

    const user = result.recordset[0];

    if (!user.is_active) {
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
        .input('id', sql.Int, user[idColumn])
        .query(`
          UPDATE ${tableName}
          SET password_reset_token = NULL,
              password_reset_expires = NULL
          WHERE ${idColumn} = @id
        `);

      await transaction
        .request()
        .input('id', sql.Int, user[idColumn])
        .input('hashed_token', sql.VarChar(255), hashedToken)
        .input('expiry', sql.DateTime2, expiryTime)
        .query(`
          UPDATE ${tableName}
          SET password_reset_token = @hashed_token,
              password_reset_expires = @expiry
          WHERE ${idColumn} = @id
        `);

      await transaction.commit();
      transaction = null;

      const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}&role=${role}`;

      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'no-reply@acharyahabba.com',
        to: user.email,
        subject: 'Password Reset Request - VTU Fest',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.full_name || 'User'},</p>
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
    console.error('Error in forgot-password:', error);

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