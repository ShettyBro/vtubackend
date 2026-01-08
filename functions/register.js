const sql = require('mssql');
const bcrypt = require('bcryptjs');
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

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Preflight
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

  const {
    full_name,
    usn,
    college_id,
    email,
    phone,
    gender,
    passport_photo_url,
    password,
  } = body;

  // Validation
  if (
    !full_name ||
    !usn ||
    !college_id ||
    !email ||
    !phone ||
    !gender ||
    !passport_photo_url ||
    !password
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "All fields are required" }),
    };
  }

  if (password.length < 8) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Password must be at least 8 characters" }),
    };
  }

  try {
    const pool = await sql.connect(dbConfig);

    // Check duplicates
    const existing = await pool
      .request()
      .input("usn", sql.VarChar, usn)
      .input("email", sql.VarChar, email)
      .input("phone", sql.VarChar, phone)
      .query(`
        SELECT student_id 
        FROM students
        WHERE usn = @usn OR email = @email OR phone = @phone
      `);

    if (existing.recordset.length > 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          message: "USN, email, or phone already registered",
        }),
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Insert student
    const insertResult = await pool
      .request()
      .input("college_id", sql.Int, college_id)
      .input("full_name", sql.VarChar, full_name)
      .input("usn", sql.VarChar, usn)
      .input("email", sql.VarChar, email)
      .input("phone", sql.VarChar, phone)
      .input("gender", sql.VarChar, gender)
      .input("passport_photo_url", sql.VarChar, passport_photo_url)
      .input("password_hash", sql.VarChar, passwordHash)
      .query(`
        INSERT INTO students (
          college_id,
          full_name,
          usn,
          email,
          phone,
          gender,
          passport_photo_url,
          password_hash
        )
        VALUES (
          @college_id,
          @full_name,
          @usn,
          @email,
          @phone,
          @gender,
          @passport_photo_url,
          @password_hash
        );

        SELECT SCOPE_IDENTITY() AS student_id;
      `);

    const student_id = insertResult.recordset[0].student_id;

    // Audit log
    await pool
      .request()
      .input("actor_user_id", sql.Int, student_id)
      .input("actor_role", sql.VarChar, "STUDENT")
      .input("action_type", sql.VarChar, "STUDENT_REGISTER")
      .input("entity_type", sql.VarChar, "STUDENT")
      .input("entity_id", sql.Int, student_id)
      .input(
        "description",
        sql.VarChar,
        `Student registered with USN ${usn}`
      )
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

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: "Student registered successfully",
        student_id,
      }),
    };
  } catch (err) {
    console.error("Student registration error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};
