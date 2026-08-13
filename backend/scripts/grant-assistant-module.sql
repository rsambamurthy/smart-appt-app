-- Grant the ASSISTANT module.
--
-- Nothing grants it automatically, and that is on purpose: every assistant
-- message costs real money at Anthropic, so an association gets it when someone
-- decides they should have it, not because a migration ran.
--
-- Run AFTER 20260813000001_assistant_module_enum, or 'ASSISTANT' does not exist
-- as an enum value yet and this fails on the cast.

-- ── 1. Who has what today ────────────────────────────────────────────────────
SELECT a.name,
       am.module,
       am.status,
       am.starts_on,
       am.expires_on
  FROM associations a
  LEFT JOIN association_modules am ON am.association_id = a.id
 WHERE a.deleted_at IS NULL
 ORDER BY a.name, am.module;

-- ── 2. Grant it ──────────────────────────────────────────────────────────────
-- Change the name. expires_on NULL means perpetual — fine while you are the
-- only customer, but set a real date once you are charging for this.
--
-- updated_at is supplied explicitly. Prisma's @updatedAt is applied by the
-- client, not by a database default, so a raw INSERT that omits it fails on a
-- NOT NULL violation.

BEGIN;

INSERT INTO association_modules
       (association_id, module, status, starts_on, expires_on, note, updated_at)
SELECT a.id,
       'ASSISTANT'::"ModuleKey",
       'ACTIVE'::"SubscriptionStatus",
       CURRENT_DATE,
       NULL,
       'Granted manually while the assistant is in trial.',
       NOW()
  FROM associations a
 WHERE a.name = 'Park Avenue Owners Association'   -- <<< change this
   AND a.deleted_at IS NULL
ON CONFLICT (association_id, module) DO UPDATE
   SET status     = 'ACTIVE'::"SubscriptionStatus",
       expires_on = NULL,
       updated_at = NOW();

-- ── 3. Confirm before committing ─────────────────────────────────────────────
SELECT a.name, am.module, am.status, am.starts_on, am.expires_on
  FROM association_modules am
  JOIN associations a ON a.id = am.association_id
 WHERE am.module = 'ASSISTANT';

COMMIT;
-- ROLLBACK;  -- if the row above is not what you expected
