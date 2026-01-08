import { handlerWrapper } from '../../shared/utils/handlerWrapper.js';
import { getSQLPool } from '../../shared/db/sqlPool.js';
import { AppError } from '../../shared/errors/AppError.js';
import { successResponse } from '../../shared/utils/response.js';
import { writeAuditLog } from '../../shared/audit/auditLogger.js';
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from '../../shared/rate-limit/loginRateLimiter.js';
import { signJWT } from '../../shared/auth/jwt.js';
import bcrypt from 'bcrypt';
import sql from 'mssql';

async function loginStudentHandler(event: any, context: any) {
  const pool = await getSQLPool();
  const { usn, password } = JSON.parse(event.body || '{}');

  if (!usn || !password) {
    throw new AppError('VALIDATION_ERROR', 400, 'USN and password required');
  }

  await checkLoginRateLimit(usn);

  const result = await pool.request()
    .input('usn', sql.VarChar, usn)
    .query(`
      SELECT student_id, password_hash, college_id, is_active
      FROM students
      WHERE usn = @usn
    `);

  if (result.recordset.length === 0) {
    await recordLoginFailure(usn);
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  const student = result.recordset[0];

  if (!student.is_active) {
    throw new AppError('ACCOUNT_DISABLED', 403, 'Account is inactive');
  }

  const valid = await bcrypt.compare(password, student.password_hash);
  if (!valid) {
    await recordLoginFailure(usn);
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  await recordLoginSuccess(usn);

  const token = signJWT({
    student_id: student.student_id,
    usn,
    role: 'STUDENT',
    college_id: student.college_id
  });

  await writeAuditLog({
    actor_user_id: student.student_id,
    actor_role: 'STUDENT',
    action_type: 'STUDENT_LOGIN',
    entity_type: 'STUDENT',
    entity_id: student.student_id,
    description: `Student login for USN ${usn}`
  });

  return successResponse(
    { token },
    context.requestId
  );
}

export default handlerWrapper(loginStudentHandler);
