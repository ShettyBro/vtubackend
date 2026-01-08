// shared/rate-limit/loginRateLimiter.ts
import sql from 'mssql';
import { getSQLPool } from '../db/sqlPool.js';
import { AppError } from '../errors/AppError.js';

const MAX_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 15;

export async function checkLoginRateLimit(identifier: string): Promise<void> {
  const pool = await getSQLPool();

  const result = await pool.request()
    .input('identifier', sql.VarChar(255), identifier)
    .query(`
      SELECT attempt_count, locked_until
      FROM login_attempts
      WHERE identifier = @identifier
    `);

  if (result.recordset.length === 0) return;

  const { attempt_count, locked_until } = result.recordset[0];

  if (locked_until && new Date(locked_until) > new Date()) {
    throw new AppError(
      'RATE_LIMIT_EXCEEDED',
      429,
      'Too many login attempts. Please try again later.'
    );
  }

  if (attempt_count >= MAX_ATTEMPTS) {
    throw new AppError(
      'RATE_LIMIT_EXCEEDED',
      429,
      'Too many login attempts. Please try again later.'
    );
  }
}

export async function recordLoginFailure(identifier: string): Promise<void> {
  const pool = await getSQLPool();

  await pool.request()
    .input('identifier', sql.VarChar(255), identifier)
    .query(`
      MERGE login_attempts AS t
      USING (SELECT @identifier AS identifier) s
      ON t.identifier = s.identifier
      WHEN MATCHED THEN
        UPDATE SET
          attempt_count = t.attempt_count + 1,
          last_attempt_at = SYSUTCDATETIME(),
          locked_until = CASE
            WHEN t.attempt_count + 1 >= ${MAX_ATTEMPTS}
            THEN DATEADD(MINUTE, ${COOLDOWN_MINUTES}, SYSUTCDATETIME())
            ELSE NULL
          END
      WHEN NOT MATCHED THEN
        INSERT (identifier, attempt_count, first_attempt_at, last_attempt_at)
        VALUES (@identifier, 1, SYSUTCDATETIME(), SYSUTCDATETIME());
    `);
}

export async function recordLoginSuccess(identifier: string): Promise<void> {
  const pool = await getSQLPool();

  await pool.request()
    .input('identifier', sql.VarChar(255), identifier)
    .query(`
      UPDATE login_attempts
      SET attempt_count = 0,
          locked_until = NULL
      WHERE identifier = @identifier
    `);
}
