// student-registration.js
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

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

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTAINER_NAME = 'student-documents';
const SESSION_EXPIRY_MINUTES = 25;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const generateSASUrl = (blobName) => {
  const sharedKeyCredential = new StorageSharedKeyCredential(
    STORAGE_ACCOUNT_NAME,
    STORAGE_ACCOUNT_KEY
  );

  const now = new Date();
  
  const sasOptions = {
    containerName: CONTAINER_NAME,
    blobName: blobName,
    permissions: BlobSASPermissions.parse('cw'), // ← Changed back to 'cw' (create + write)
    startsOn: new Date(now.getTime() - 5 * 60 * 1000), // 5 mins ago for clock skew
    expiresOn: new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000),
    version: '2021-08-06', // ← ADD THIS: specify service version
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();

  return `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sasToken}`;
};

const blobExists = async (blobName) => {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    `DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT_NAME};AccountKey=${STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
  );
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(blobName);
  return await blobClient.exists();
};

const getBlobSize = async (blobName) => {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    `DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT_NAME};AccountKey=${STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
  );
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(blobName);
  const properties = await blobClient.getProperties();
  return properties.contentLength;
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
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    pool = await sql.connect(dbConfig);

    if (action === 'init') {
      const { usn, full_name, email, mobile, gender, college_id } = body;

      if (!usn || typeof usn !== 'string' || !usn.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'USN is required' }),
        };
      }

      if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Full name is required' }),
        };
      }

      if (!email || typeof email !== 'string' || !email.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email is required' }),
        };
      }

      if (!mobile || typeof mobile !== 'string' || !mobile.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Mobile is required' }),
        };
      }

      if (!gender || !['Male', 'Female', 'Other'].includes(gender)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Valid gender is required' }),
        };
      }

      if (!college_id || typeof college_id !== 'number') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'College ID is required' }),
        };
      }

      const normalizedUSN = usn.trim().toUpperCase();
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedMobile = mobile.trim();

      const usnCheck = await pool
        .request()
        .input('usn', sql.VarChar(50), normalizedUSN)
        .query('SELECT student_id FROM students WHERE usn = @usn');

      if (usnCheck.recordset.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'USN already registered' }),
        };
      }

      const emailCheck = await pool
        .request()
        .input('email', sql.VarChar(255), normalizedEmail)
        .query('SELECT student_id FROM students WHERE email = @email');

      if (emailCheck.recordset.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email already registered' }),
        };
      }

      const mobileCheck = await pool
        .request()
        .input('phone', sql.VarChar(20), normalizedMobile)
        .query('SELECT student_id FROM students WHERE phone = @phone');

      if (mobileCheck.recordset.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Mobile already registered' }),
        };
      }

      const collegeResult = await pool
        .request()
        .input('college_id', sql.Int, college_id)
        .query(`
          SELECT college_code, is_active
          FROM colleges
          WHERE college_id = @college_id
        `);

      if (collegeResult.recordset.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid college' }),
        };
      }

      if (!collegeResult.recordset[0].is_active) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'College is not active' }),
        };
      }

      const college_code = collegeResult.recordset[0].college_code;
      const session_id = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000);

      await pool
        .request()
        .input('session_id', sql.VarChar(64), session_id)
        .input('usn', sql.VarChar(50), normalizedUSN)
        .input('full_name', sql.VarChar(255), full_name.trim())
        .input('email', sql.VarChar(255), normalizedEmail)
        .input('phone', sql.VarChar(20), normalizedMobile)
        .input('gender', sql.VarChar(10), gender)
        .input('college_id', sql.Int, college_id)
        .input('expires_at', sql.DateTime2, expires_at)
        .query(`
          INSERT INTO registration_sessions 
          (session_id, usn, full_name, email, phone, gender, college_id, expires_at)
          VALUES 
          (@session_id, @usn, @full_name, @email, @phone, @gender, @college_id, @expires_at)
        `);

      const basePath = `${college_code}/${normalizedUSN}/photo`;
      const upload_urls = {
        passport_photo: generateSASUrl(`${basePath}/passportphoto`),
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          session_id,
          upload_urls,
          expires_at: expires_at.toISOString(),
        }),
      };
    }

    if (action === 'finalize') {
      const { session_id, password } = body;

      if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Session ID is required' }),
        };
      }

      if (!password || typeof password !== 'string' || password.length < 8) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Password must be at least 8 characters' }),
        };
      }

      const sessionResult = await pool
        .request()
        .input('session_id', sql.VarChar(64), session_id.trim())
        .query(`
          SELECT session_id, usn, full_name, email, phone, gender, college_id, expires_at
          FROM registration_sessions
          WHERE session_id = @session_id
        `);

      if (sessionResult.recordset.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired session' }),
        };
      }

      const session = sessionResult.recordset[0];
      const now = new Date();
      const expiryDate = new Date(session.expires_at);

      if (now > expiryDate) {
        await pool
          .request()
          .input('session_id', sql.VarChar(64), session_id.trim())
          .query('DELETE FROM registration_sessions WHERE session_id = @session_id');

        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Session has expired' }),
        };
      }

      const collegeResult = await pool
        .request()
        .input('college_id', sql.Int, session.college_id)
        .query('SELECT college_code FROM colleges WHERE college_id = @college_id');

      const college_code = collegeResult.recordset[0].college_code;
      const passportPhotoBlob = `${college_code}/${session.usn}/photo/passportphoto`;

      const photoExists = await blobExists(passportPhotoBlob);
      if (!photoExists) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Passport photo not uploaded' }),
        };
      }

      const photoSize = await getBlobSize(passportPhotoBlob);
      if (photoSize > MAX_FILE_SIZE) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Passport photo exceeds 5MB limit' }),
        };
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const baseUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}`;
      const passport_photo_url = `${baseUrl}/${college_code}/${session.usn}/photo/passportphoto`;

      await pool
        .request()
        .input('college_id', sql.Int, session.college_id)
        .input('full_name', sql.VarChar(255), session.full_name)
        .input('usn', sql.VarChar(50), session.usn)
        .input('email', sql.VarChar(255), session.email)
        .input('phone', sql.VarChar(20), session.phone)
        .input('gender', sql.VarChar(10), session.gender)
        .input('passport_photo_url', sql.VarChar(500), passport_photo_url)
        .input('password_hash', sql.VarChar(255), passwordHash)
        .query(`
          INSERT INTO students 
          (college_id, full_name, usn, email, phone, gender, passport_photo_url, password_hash, is_active)
          VALUES 
          (@college_id, @full_name, @usn, @email, @phone, @gender, @passport_photo_url, @password_hash, 1)
        `);

      await pool
        .request()
        .input('session_id', sql.VarChar(64), session_id.trim())
        .query('DELETE FROM registration_sessions WHERE session_id = @session_id');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Registration successful. You can now login with your credentials.',
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' }),
    };
  } catch (error) {
    console.error('Error in student-registration:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'An error occurred processing your request' }),
    };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
};