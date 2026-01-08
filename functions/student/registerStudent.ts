import { handlerWrapper } from '../../shared/utils/handlerWrapper.js';
import { getSQLPool } from '../../shared/db/sqlPool.js';
import { AppError } from '../../shared/errors/AppError.js';
import { successResponse } from '../../shared/utils/response.js';
import { writeAuditLog } from '../../shared/audit/auditLogger.js';
import bcrypt from 'bcrypt';
import sql from 'mssql';

async function registerStudentHandler(event: any, context: any) {
  const pool = await getSQLPool();
  const body = JSON.parse(event.body || '{}');

  const {
    full_name,
    usn,
    college_id,
    email,
    mobile,
    gender,
    passport_photo_url,
    password
  } = body;

  if (!full_name || !usn || !college_id || !email || !mobile || !gender || !passport_photo_url || !password) {
    throw new AppError('VALIDATION_ERROR', 400, 'All fields are required');
  }

  if (password.length < 8) {
    throw new AppError('WEAK_PASSWORD', 400, 'Password must be at least 8 characters');
  }

  const tx = pool.transaction();
  await tx.begin();

  try {
    const dupCheck = await tx.request()
      .input('usn', sql.VarChar, usn)
      .input('email', sql.VarChar, email)
      .input('mobile', sql.VarChar, mobile)
      .query(`
        SELECT 1 FROM students
        WHERE usn = @usn OR email = @email OR mobile = @mobile
      `);

    if (dupCheck.recordset.length > 0) {
      throw new AppError('DUPLICATE_STUDENT', 409, 'USN, email or mobile already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insert = await tx.request()
      .input('full_name', sql.VarChar, full_name)
      .input('usn', sql.VarChar, usn)
      .input('college_id', sql.Int, college_id)
      .input('email', sql.VarChar, email)
      .input('mobile', sql.VarChar, mobile)
      .input('gender', sql.VarChar, gender)
      .input('passport_photo_url', sql.VarChar, passport_photo_url)
      .input('password_hash', sql.VarChar, passwordHash)
      .query(`
        INSERT INTO students (
          full_name, usn, college_id, email, mobile, gender,
          passport_photo_url, password_hash
        )
        VALUES (
          @full_name, @usn, @college_id, @email, @mobile, @gender,
          @passport_photo_url, @password_hash
        );
        SELECT SCOPE_IDENTITY() AS student_id;
      `);

    const studentId = insert.recordset[0].student_id;

    await writeAuditLog({
      actor_user_id: studentId,
      actor_role: 'STUDENT',
      action_type: 'STUDENT_REGISTER',
      entity_type: 'STUDENT',
      entity_id: studentId,
      description: `Student registered with USN ${usn}`
    });

    await tx.commit();

    return successResponse(
      { student_id: studentId, message: 'Student registered successfully' },
      context.requestId
    );
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export default handlerWrapper(registerStudentHandler);
