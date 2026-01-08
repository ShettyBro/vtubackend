export interface AuditLogEntry {
    actor_user_id: number | null;
    actor_role: string;
    action_type: string;
    entity_type: string;
    entity_id: number | null;
    description: string;
}
export declare function writeAuditLog(entry: AuditLogEntry): Promise<void>;
//# sourceMappingURL=auditLogger.d.ts.map