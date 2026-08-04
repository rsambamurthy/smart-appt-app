-- Repair: menu_group_config per-association migration.
--
-- WHY THIS EXISTS
-- Migration 20260804000002 dropped the old UNIQUE (group_id, role) index
-- AFTER fanning the global rows out to every association. The index was still
-- live during the insert, so the second association's copy violated it and the
-- migration failed. start.sh then baselined it — marking it applied without
-- running it — so the backend came up with new code against the old schema and
-- every read of menu_group_config returns 500.
--
-- SAFE TO RUN MORE THAN ONCE. Every step checks the current state first, so it
-- works whether the migration failed cleanly, half-applied, or was baselined.
--
-- Run against Gold (smart-appt-app-development), then restart the backend.

BEGIN;

-- ── 1. Where are we? ─────────────────────────────────────────────────────────
-- Read this before the rest runs; it tells you what was actually wrong.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'menu_group_config' AND column_name = 'association_id')
    AS has_association_id,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE tablename = 'menu_group_config'
             AND indexname = 'menu_group_config_group_id_role_key')
    AS old_unique_still_there,
  (SELECT COUNT(*) FROM menu_group_config)  AS rows_now,
  (SELECT COUNT(*) FROM associations)       AS associations;

-- ── 2. Column ────────────────────────────────────────────────────────────────
ALTER TABLE "menu_group_config" ADD COLUMN IF NOT EXISTS "association_id" UUID;

-- ── 3. Old unique key goes FIRST ─────────────────────────────────────────────
-- This is the whole bug. It must be gone before the fan-out, or the second
-- association's copy of any (group_id, role) collides with the first.
-- Dropped as a constraint too: if it was ever promoted to one, DROP INDEX
-- alone fails with "cannot drop index ... constraint requires it".
ALTER TABLE "menu_group_config"
  DROP CONSTRAINT IF EXISTS "menu_group_config_group_id_role_key";
DROP INDEX IF EXISTS "menu_group_config_group_id_role_key";

-- ── 4. Fan the global rows out ───────────────────────────────────────────────
INSERT INTO "menu_group_config" ("id", "association_id", "group_id", "role", "enabled", "updated_at")
SELECT gen_random_uuid(), a."id", m."group_id", m."role", m."enabled", now()
  FROM "menu_group_config" m
 CROSS JOIN "associations" a
 WHERE m."association_id" IS NULL
   -- Re-run safety: skip any pair that already has its association-scoped copy.
   AND NOT EXISTS (
     SELECT 1 FROM "menu_group_config" x
      WHERE x."association_id" = a."id"
        AND x."group_id"       = m."group_id"
        AND x."role"           = m."role"
   );

DELETE FROM "menu_group_config" WHERE "association_id" IS NULL;

-- ── 5. Constraints ───────────────────────────────────────────────────────────
ALTER TABLE "menu_group_config" ALTER COLUMN "association_id" SET NOT NULL;

ALTER TABLE "menu_group_config"
  DROP CONSTRAINT IF EXISTS "menu_group_config_association_id_fkey";
ALTER TABLE "menu_group_config"
  ADD CONSTRAINT "menu_group_config_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "menu_group_config_association_id_group_id_role_key"
  ON "menu_group_config"("association_id", "group_id", "role");

CREATE INDEX IF NOT EXISTS "menu_group_config_association_id_idx"
  ON "menu_group_config"("association_id");

-- ── 6. Tell Prisma it is done ────────────────────────────────────────────────
-- If the migration was recorded as failed, `migrate deploy` refuses to run
-- anything at all on the next boot until the record is cleared. Marking it
-- finished is honest here: the schema now matches what the migration describes.
UPDATE "_prisma_migrations"
   SET "finished_at"     = COALESCE("finished_at", now()),
       "rolled_back_at"  = NULL,
       "applied_steps_count" = 1
 WHERE "migration_name" = '20260804000002_menu_config_per_association';

-- ── 7. Prove it ──────────────────────────────────────────────────────────────
-- Expect: has_association_id = true, old_unique_still_there = false,
-- and no rows with a null association.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'menu_group_config' AND column_name = 'association_id')
    AS has_association_id,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE tablename = 'menu_group_config'
             AND indexname = 'menu_group_config_group_id_role_key')
    AS old_unique_still_there,
  (SELECT COUNT(*) FROM menu_group_config)                              AS rows_now,
  (SELECT COUNT(*) FROM menu_group_config WHERE association_id IS NULL) AS orphan_rows;

COMMIT;
