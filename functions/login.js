const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * IMPORTANT:
 * Replace this with the actual user_id of:
 * email = system@vtufest.local
 */
const SYSTEM_USER_ID = 42; // <-- CHANGE THIS

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

const MAX_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 15;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
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
    body = JSON.parse(event.body || "{}");
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

    /* ================= RATE LIMIT ================= */
    const rateRes = await pool.request()
      .input("identifier", sql.VarChar, usn)
      .query(`
        SELECT attempt_count, last_attempt_at
        FROM login_attempts
        WHERE identifier = @identifier
      `);

    if (rateRes.recordset.length > 0) {
      const { attempt_count, last_attempt_at } = rateRes.recordset[0];
      const minutesSinceLast =
        (Date.now() - new Date(last_attempt_at).getTime()) / 60000;

      if (attempt_count >= MAX_ATTEMPTS && minutesSinceLast < COOLDOWN_MINUTES) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            message: "Too many login attempts. Please try again later.",
          }),
        };
      }
    }

    /* ================= FETCH STUDENT ================= */
    const studentRes = await pool.request()
      .input("usn", sql.VarChar, usn)
      .query(`
        SELECT
          student_id,
          usn,
          college_id,
          password_hash,
          is_active
        FROM students
        WHERE usn = @usn
      `);

    if (studentRes.recordset.length === 0) {
      await recordFailedAttempt(pool, usn);
      return invalidCredentials(headers);
    }

    const student = studentRes.recordset[0];

    if (!student.is_active) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Account is inactive" }),
      };
    }

    const passwordValid = await bcrypt.compare(
      password,
      student.password_hash
    );

    if (!passwordValid) {
      await recordFailedAttempt(pool, usn);
      return invalidCredentials(headers);
    }

    /* ================= RESET RATE LIMIT ================= */
    await pool.request()
      .input("identifier", sql.VarChar, usn)
      .query(`DELETE FROM login_attempts WHERE identifier = @identifier`);

    /* ================= JWT ================= */
    const token = jwt.sign(
      {
        student_id: student.student_id,
        usn: student.usn,
        college_id: student.college_id,
        role: "STUDENT",
      },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    /* ================= AUDIT LOG ================= */
    await pool.request()
      .input("actor_user_id", sql.Int, SYSTEM_USER_ID)
      .input("actor_role", sql.VarChar, "SYSTEM")
      .input("action_type", sql.VarChar, "STUDENT_LOGIN")
      .input("entity_type", sql.VarChar, "STUDENT")
      .input("entity_id", sql.Int, student.student_id)
      .input(
        "description",
        sql.VarChar,
        `Student login successful. USN=${student.usn}`
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
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

/* ================= HELPERS ================= */

async function recordFailedAttempt(pool, usn) {
  await pool.request()
    .input("identifier", sql.VarChar, usn)
    .query(`
      MERGE login_attempts AS target
      USING (SELECT @identifier AS identifier) AS source
      ON target.identifier = source.identifier
      WHEN MATCHED THEN
        UPDATE SET
          attempt_count = attempt_count + 1,
          last_attempt_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (identifier, attempt_count, last_attempt_at)
        VALUES (@identifier, 1, SYSUTCDATETIME());
    `);
}

function invalidCredentials(headers) {
  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({ message: "Invalid credentials" }),
  };
}
