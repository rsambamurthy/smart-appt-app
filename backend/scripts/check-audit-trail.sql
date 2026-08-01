-- ============================================================================
--  Diagnose why an audit event did not appear. All read-only.
--  Run against the GOLD database (smart-appt-app-development).
-- ============================================================================


-- ─── CHECK 1: Did the migration actually apply the new action values? ───────
-- MOST LIKELY CAUSE. Audit writes are deliberately non-fatal: if the enum is
-- missing a value, Postgres rejects the insert, the error is logged, and the
-- business action still succeeds — so the event silently never appears.
--
-- Expect 16 rows including LOGIN, LOGIN_FAILED, LOGOUT, MPIN_SET, MPIN_RESET.
-- If you only see CREATE/UPDATE/DELETE/APPROVE/REJECT, the migration did NOT run.

SELECT e.enumlabel AS available_action
FROM   pg_enum e
JOIN   pg_type t ON t.oid = e.enumtypid
WHERE  t.typname = 'AuditAction'
ORDER  BY e.enumsortorder;


-- ─── CHECK 2: Is the migration recorded as applied? ─────────────────────────
SELECT migration_name, finished_at, rolled_back_at
FROM   _prisma_migrations
WHERE  migration_name LIKE '%audit_log_expansion%'
    OR migration_name LIKE '%2026080100000%'
ORDER  BY migration_name;


-- ─── CHECK 3: Do the new columns exist? ─────────────────────────────────────
-- Expect actor_label, user_agent, summary to be present.
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_name = 'audit_logs'
ORDER  BY ordinal_position;


-- ─── CHECK 4: What HAS been captured recently? ──────────────────────────────
SELECT created_at,
       action,
       entity_type,
       summary,
       actor_label,
       ip_address,
       performed_by
FROM   audit_logs
ORDER  BY created_at DESC
LIMIT  30;


-- ─── CHECK 5: Counts by action — shows which categories are working ─────────
SELECT action, COUNT(*) AS entries, MAX(created_at) AS most_recent
FROM   audit_logs
GROUP  BY action
ORDER  BY entries DESC;


-- ============================================================================
--  IF CHECK 1 SHOWS ONLY THE 5 ORIGINAL VALUES, run this to add them manually.
--  Safe and idempotent. Run each line separately if your client wraps
--  statements in a transaction.
-- ============================================================================

-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANCEL';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLOSE';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REOPEN';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GENERATE';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROLLBACK';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UPLOAD';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MPIN_SET';
-- ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MPIN_RESET';
