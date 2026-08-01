-- ─── Audit log expansion ─────────────────────────────────────────────────────
-- Adds the action types needed for financial, config, auth and deletion events,
-- relaxes NOT NULL on actor/association (a failed login has neither), and adds
-- request metadata used as audit evidence.
--
-- All statements are idempotent so the startup self-heal can re-run them safely.

-- 1. New audit actions -------------------------------------------------------
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANCEL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLOSE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REOPEN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GENERATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROLLBACK';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UPLOAD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MPIN_SET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MPIN_RESET';

-- 2. Allow events with no known actor / association / single entity ----------
ALTER TABLE "audit_logs" ALTER COLUMN "association_id" DROP NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "performed_by"   DROP NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "entity_id"      DROP NOT NULL;

-- 3. Request metadata + readable summary -------------------------------------
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_label" VARCHAR(120);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent"  VARCHAR(255);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "summary"     VARCHAR(255);

-- 4. Indexes for the audit viewer's filters ----------------------------------
CREATE INDEX IF NOT EXISTS "audit_logs_association_id_created_at_idx"
  ON "audit_logs" ("association_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"
  ON "audit_logs" ("action");
