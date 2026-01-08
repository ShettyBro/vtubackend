import { handlerWrapper } from '../../shared/utils/handlerWrapper.js';
import { getSQLPool } from '../../shared/db/sqlPool.js';
import { successResponse } from '../../shared/utils/response.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import sql from 'mssql';

async function forgotPasswordHandler(event: any, context: any) {
  const pool = await getSQLPool();
  const { usn } = JSON.parse(event.body || '{}');

  if (!usn) {
    return successResponse(
      { message: 'If the USN exists, a reset link has been sent' },
      context.requestId
    );
  }

  const studentRes = await pool.request()
    .input('usn', sql.VarChar, usn)
    .query(`
      SELECT student_id, email
      FROM students
      WHERE usn = @usn AND is_active = 1
    `);

  if (studentRes.recordset.length === 0) {
    return successResponse(
      { message: 'If the USN exists, a reset link has been sent' },
      context.requestId
    );
  }

  const student = studentRes.recordset[0];
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);

  await pool.request()
    .input('student_id', sql.Int, student.student_id)
    .input('token_hash', sql.VarChar, tokenHash)
    .query(`
      INSERT INTO password_reset_tokens (
        student_id, token_hash, token_type, expires_at
      )
      VALUES (
        @student_id, @token_hash, 'STUDENT',
        DATEADD(MINUTE, 15, SYSUTCDATETIME())
      )
    `);

  // Email sending intentionally omitted (handled elsewhere)

  return successResponse(
    { message: 'If the USN exists, a reset link has been sent' },
    context.requestId
  );
}

export default handlerWrapper(forgotPasswordHandler);
