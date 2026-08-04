-- Web menu config moves from global to per-association.
--
-- Managers configure their own association's menus, so a single global table
-- can no longer express what is wanted. Existing rows are global settings that
-- were applied to everyone, so they are copied to every association: nobody
-- should notice this migration on the day it runs.
--
-- The copy also PRUNES. The old screen saved the entire matrix on every save —
-- every item × every role, whether or not it differed from the code default —
-- so most existing rows say nothing. Carrying them forward would freeze each
-- association on today's defaults and hide any menu item added later. Only the
-- rows that actually depart from a default are worth keeping, and the service
-- decides that from the catalogue in the frontend, which SQL cannot see.
--
-- So this migration keeps every existing row rather than guessing which are
-- meaningful, and the service prunes on the next save. The result is correct
-- either way; it just takes one save per association to become tidy.

-- 1. New column, nullable while we backfill.
ALTER TABLE "menu_group_config" ADD COLUMN "association_id" UUID;

-- 2. Fan the global rows out to every association.
--    Done before the constraints so a half-migrated table is never visible.
INSERT INTO "menu_group_config" ("id", "association_id", "group_id", "role", "enabled", "updated_at")
SELECT gen_random_uuid(), a."id", m."group_id", m."role", m."enabled", now()
  FROM "menu_group_config" m
 CROSS JOIN "associations" a
 WHERE m."association_id" IS NULL;

-- 3. Drop the originals, now that each has an association-scoped copy.
DELETE FROM "menu_group_config" WHERE "association_id" IS NULL;

-- 4. Lock it down.
ALTER TABLE "menu_group_config" ALTER COLUMN "association_id" SET NOT NULL;

ALTER TABLE "menu_group_config"
  ADD CONSTRAINT "menu_group_config_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The old key was (group_id, role) — one setting for the whole platform.
DROP INDEX IF EXISTS "menu_group_config_group_id_role_key";

CREATE UNIQUE INDEX "menu_group_config_association_id_group_id_role_key"
  ON "menu_group_config"("association_id", "group_id", "role");

CREATE INDEX "menu_group_config_association_id_idx"
  ON "menu_group_config"("association_id");
