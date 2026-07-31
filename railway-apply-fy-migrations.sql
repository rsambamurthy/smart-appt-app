-- Step 1: Create the financial_year_closes table
-- closing_entry_id is VARCHAR(30) from the start (combines migrations 1 + 2)
CREATE TABLE IF NOT EXISTS "financial_year_closes" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id"   UUID NOT NULL,
    "financial_year"   VARCHAR(7) NOT NULL,
    "status"           VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    "net_surplus"      DECIMAL(15,2) NOT NULL,
    "closing_entry_id" VARCHAR(30),
    "notes"            TEXT,
    "closed_by_id"     UUID,
    "closed_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "reopened_by_id"   UUID,
    "reopened_at"      TIMESTAMPTZ,

    CONSTRAINT "financial_year_closes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "financial_year_closes"
    DROP CONSTRAINT IF EXISTS "financial_year_closes_association_id_fkey";
ALTER TABLE "financial_year_closes"
    ADD CONSTRAINT "financial_year_closes_association_id_fkey"
    FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE;

ALTER TABLE "financial_year_closes"
    DROP CONSTRAINT IF EXISTS "financial_year_closes_closed_by_id_fkey";
ALTER TABLE "financial_year_closes"
    ADD CONSTRAINT "financial_year_closes_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "financial_year_closes"
    DROP CONSTRAINT IF EXISTS "financial_year_closes_reopened_by_id_fkey";
ALTER TABLE "financial_year_closes"
    ADD CONSTRAINT "financial_year_closes_reopened_by_id_fkey"
    FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "financial_year_closes_association_id_financial_year_key"
    ON "financial_year_closes"("association_id", "financial_year");

-- Step 2: Make sure Prisma's migrations table exists
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                   VARCHAR(36) NOT NULL,
    "checksum"             VARCHAR(64) NOT NULL,
    "finished_at"          TIMESTAMPTZ,
    "migration_name"       VARCHAR(255) NOT NULL,
    "logs"                 TEXT,
    "rolled_back_at"       TIMESTAMPTZ,
    "started_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Step 3: Add menu_items column to mobile_config (migration 3)
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "menu_items" JSONB;

-- Step 4: Mark all three migrations as applied so prisma migrate deploy never re-runs them
INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
VALUES
  (gen_random_uuid()::text, 'manually-applied', now(), '20260731000001_add_fy_closure',              NULL, NULL, now(), 1),
  (gen_random_uuid()::text, 'manually-applied', now(), '20260731000002_fix_closing_entry_id_type',   NULL, NULL, now(), 1),
  (gen_random_uuid()::text, 'manually-applied', now(), '20260731000003_add_mobile_menu_items',       NULL, NULL, now(), 1)
ON CONFLICT DO NOTHING;
