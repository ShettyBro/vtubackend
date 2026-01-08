// shared/audit/auditLogger.ts
import sql from 'mssql';
import { getSQLPool } from '../db/sqlPool.js';

export interface AuditLogEntry {
  actor_user_id: number | null;
  actor_role: string;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const pool = await getSQLPool();

  await pool.request()
    .input('actor_user_id', sql.Int, entry.actor_user_id)
    .input('actor_role', sql.VarChar(50), entry.actor_role)
    .input('action_type', sql.VarChar(50), entry.action_type)
    .input('entity_type', sql.VarChar(50), entry.entity_type)
    .input('entity_id', sql.Int, entry.entity_id)
    .input('description', sql.VarChar(500), entry.description)
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
}
