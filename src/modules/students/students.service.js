import sql from "mssql";
import db from "../../config/database.js";
import { hashPassword } from "../../utils/password.util.js";
import { comparePassword } from "../../utils/password.util.js";

export async function createStudent(data) {
  const {
    collegeCode,
    usn,
    fullName,
    phone,
    email,
    gender,
    password
  } = data;

  if (!collegeCode || !usn || !password || !gender) {
    throw new Error("Missing required fields");
  }

  const passwordHash = await hashPassword(password);
  const pool = await db.getPool();

  // Resolve college
  const college = await pool.request()
    .input("collegeCode", sql.VarChar, collegeCode)
    .query(`SELECT college_id, college_code FROM colleges WHERE college_code=@collegeCode`);

  if (!college.recordset.length) {
    throw new Error("Invalid college code");
  }

  const collegeId = college.recordset[0].college_id;

  // Duplicate check
  const exists = await pool.request()
    .input("usn", sql.VarChar, usn)
    .query(`SELECT 1 FROM students WHERE usn=@usn`);

  if (exists.recordset.length) {
    throw new Error("Student already registered");
  }

  // Insert student
  await pool.request()
    .input("collegeId", sql.Int, collegeId)
    .input("usn", sql.VarChar, usn)
    .input("fullName", sql.VarChar, fullName)
    .input("phone", sql.VarChar, phone)
    .input("email", sql.VarChar, email)
    .input("gender", sql.VarChar, gender)
    .input("passwordHash", sql.VarChar, passwordHash)
    .query(`
      INSERT INTO students (
        college_id, usn, full_name, phone, email, gender,
        password_hash, reapply_count, is_active, created_at
      )
      VALUES (
        @collegeId, @usn, @fullName, @phone, @email, @gender,
        @passwordHash, 0, 1, GETDATE()
      )
    `);

  return { usn, collegeCode };
}

export async function saveStudentDocument({ studentId, docType, url }) {
  const pool = await db.getPool();

  await pool.request()
    .input("studentId", sql.Int, studentId)
    .input("docType", sql.VarChar, docType)
    .input("url", sql.VarChar, url)
    .query(`
      INSERT INTO application_documents (
        student_id, document_type, document_url, uploaded_at
      )
      VALUES (@studentId, @docType, @url, GETDATE())
    `);
}


export async function verifyStudentLogin(usn, password) {
  const pool = await db.getPool();

  const result = await pool.request()
    .input("usn", sql.VarChar, usn)
    .query(`
      SELECT student_id, college_id, usn, full_name, password_hash
      FROM students
      WHERE usn = @usn AND is_active = 1
    `);

  if (!result.recordset.length) {
    throw new Error("Invalid credentials");
  }

  const student = result.recordset[0];
  const match = await comparePassword(password, student.password_hash);

  if (!match) {
    throw new Error("Invalid credentials");
  }

  return student;
}
