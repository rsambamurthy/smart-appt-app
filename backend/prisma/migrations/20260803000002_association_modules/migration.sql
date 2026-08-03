-- Module subscriptions.
--
-- Entitlement — which paid modules an association may use. Deliberately
-- separate from mobile_config and menu_group_config, which record what an
-- association CHOOSES to show. If the two were the same table, an association
-- could toggle itself into a module it has not paid for.
--
-- Core features (dues, receipts, maintenance, announcements, documents, polls,
-- visitors) are never represented here. They are free for every association
-- and must not depend on a row existing.

CREATE TYPE "ModuleKey"          AS ENUM ('ACCOUNTING', 'GOVERNANCE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'CANCELLED');

CREATE TABLE "association_modules" (
  "id"             UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID                 NOT NULL,
  "module"         "ModuleKey"          NOT NULL,
  "status"         "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',

  "starts_on"      DATE                 NOT NULL,
  -- NULL means perpetual. Effective access is computed from this date at read
  -- time rather than from `status`, because a stored status goes stale the
  -- moment a date passes with nobody looking at it.
  "expires_on"     DATE,

  -- For your own records; invoicing happens outside the application.
  "amount"         DECIMAL(12, 2),
  "reference"      VARCHAR(120),
  "note"           TEXT,

  "granted_by_id"  UUID,
  "created_at"     TIMESTAMPTZ          NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ          NOT NULL,

  CONSTRAINT "association_modules_pkey" PRIMARY KEY ("id")
);

-- One row per association per module. Renewal updates the row rather than
-- adding another, so there is never a question of which one is authoritative.
CREATE UNIQUE INDEX "association_modules_association_id_module_key"
  ON "association_modules" ("association_id", "module");

-- Supports "which subscriptions expire soon", the renewal report.
CREATE INDEX "association_modules_module_expires_on_idx"
  ON "association_modules" ("module", "expires_on");

ALTER TABLE "association_modules"
  ADD CONSTRAINT "association_modules_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the grant record if the granting super user is ever removed.
ALTER TABLE "association_modules"
  ADD CONSTRAINT "association_modules_granted_by_id_fkey"
  FOREIGN KEY ("granted_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Grandfather every existing association ───────────────────────────────────
--
-- Everyone already on the platform keeps everything, perpetually. Turning a
-- live association's accounting off during a schema migration would be an
-- appalling way to introduce a pricing model — they would discover it as a
-- 402 in the middle of a working day.
--
-- Revoking is then a deliberate act on the subscription screen, with someone
-- watching. The note makes these rows obvious when you come to review them.
--
-- updated_at has no database default: Prisma's @updatedAt is applied by the
-- client, so a raw INSERT must supply it.
INSERT INTO "association_modules"
  ("association_id", "module", "status", "starts_on", "expires_on", "note", "created_at", "updated_at")
SELECT
  a."id",
  m."module",
  'ACTIVE'::"SubscriptionStatus",
  CURRENT_DATE,
  NULL,
  'Grandfathered when module subscriptions were introduced',
  now(),
  now()
FROM "associations" a
CROSS JOIN (VALUES ('ACCOUNTING'::"ModuleKey"), ('GOVERNANCE'::"ModuleKey")) AS m("module")
ON CONFLICT ("association_id", "module") DO NOTHING;
