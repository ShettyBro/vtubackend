import sql from "mssql";
import db from "../../config/database.js";
import { comparePassword } from "../../utils/password.util.js";
import { signToken } from "../../utils/jwt.util.js";

export async function loginStudent({ usn, password }) {
  const pool = await db.getPool();

  const result = await pool.request()
    .input("usn", sql.VarChar, usn)
    .query(`
      SELECT 
        s.student_id,
        s.usn,
        s.password_hash,
        s.is_active,
        c.college_id,
        c.college_code
      FROM students s
      JOIN colleges c ON c.college_id = s.college_id
      WHERE s.usn = @usn
    `);

  if (!result.recordset.length) {
    throw new Error("Invalid USN or password");
  }

  const student = result.recordset[0];

  if (!student.is_active) {
    throw new Error("Account inactive");
  }

  const isValid = await comparePassword(password, student.password_hash);
  if (!isValid) {
    throw new Error("Invalid USN or password");
  }

  const token = signToken({
    student_id: student.student_id,
    usn: student.usn,
    college_id: student.college_id,
    college_code: student.college_code,
    role: "STUDENT"
  });

  return {
    token,
    student: {
      usn: student.usn,
      college_code: student.college_code
    }
  };
}
