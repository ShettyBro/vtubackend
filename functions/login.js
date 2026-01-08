const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

  const { usn, password } = body;

  if (!usn || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "USN and password are required" }),
    };
  }

  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool
      .request()
      .input("usn", sql.VarChar, usn)
      .query("SELECT * FROM students WHERE usn = @usn");

    if (result.recordset.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid USN or password" }),
      };
    }

    const student = result.recordset[0];

    if (!student.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Account is inactive" }),
      };
    }

    const isMatch = await bcrypt.compare(password, student.password_hash);

    if (!isMatch) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid USN or password" }),
      };
    }

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
      }),
    };
  } catch (err) {
    console.error("Student login error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Error during login", error: err.message }),
    };
  }
};