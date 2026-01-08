import { handlerWrapper } from '../../shared/utils/handlerWrapper.js';
import { getSQLPool } from '../../shared/db/sqlPool.js';
import { AppError } from '../../shared/errors/AppError.js';
import { successResponse } from '../../shared/utils/response.js';
import { writeAuditLog } from '../../shared/audit/auditLogger.js';
import bcrypt from 'bcrypt';
import sql from 'mssql';

async function resetPasswordHandler(event: any, context: any) {
  const pool = await getSQLPool();
  const { token, new_password } = JSON.parse(event.body || '{}');

  if (!token || !new_password) {
    throw new AppError('VALIDATION_ERROR', 400, 'Token and password required');
  }

  if (new_password.length < 8) {
    throw new AppError('WEAK_PASSWORD', 400, 'Password must be at least 8 characters');
  }

  const tokens = await pool.request().query(`
    SELECT reset_id, student_id, token_hash
    FROM password_reset_tokens
    WHERE token_type = 'STUDENT'
      AND is_used = 0
      AND expires_at > SYSUTCDATETIME()
  `);

  let matched: any = null;
  for (const row of tokens.recordset) {
    if (await bcrypt.compare(token, row.token_hash)) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    throw new AppError('INVALID_TOKEN', 400, 'Invalid or expired token');
  }

  const passwordHash = await bcrypt.hash(new_password, 12);

  const tx = pool.transaction();
  await tx.begin();

  try {
    await tx.request()
      .input('password_hash', sql.VarChar, passwordHash)
      .input('student_id', sql.Int, matched.student_id)
      .query(`
        UPDATE students
        SET password_hash = @password_hash
        WHERE student_id = @student_id
      `);

    await tx.request()
      .input('reset_id', sql.Int, matched.reset_id)
      .query(`
        UPDATE password_reset_tokens
        SET is_used = 1
        WHERE reset_id = @reset_id
      `);

    await writeAuditLog({
      actor_user_id: matched.student_id,
      actor_role: 'STUDENT',
      action_type: 'STUDENT_PASSWORD_RESET',
      entity_type: 'STUDENT',
      entity_id: matched.student_id,
      description: 'Student password reset'
    });

    await tx.commit();

    return successResponse(
      { message: 'Password reset successful' },
      context.requestId
    );
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export default handlerWrapper(resetPasswordHandler);
