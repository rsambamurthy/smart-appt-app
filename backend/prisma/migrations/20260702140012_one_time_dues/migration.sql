-- CreateEnum
CREATE TYPE "OneTimeDueStatus" AS ENUM ('DRAFT', 'BILLS_GENERATED', 'CLOSED');

-- CreateTable: one_time_dues
CREATE TABLE "one_time_dues" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID NOT NULL,
    "title"          VARCHAR(255) NOT NULL,
    "description"    TEXT,
    "charge_type"    "ChargeType" NOT NULL DEFAULT 'FIXED',
    "amount"         DECIMAL(10,2) NOT NULL,
    "due_date"       DATE NOT NULL,
    "status"         "OneTimeDueStatus" NOT NULL DEFAULT 'DRAFT',
    "bills_count"    INTEGER NOT NULL DEFAULT 0,
    "created_by"     UUID NOT NULL,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_dues_pkey" PRIMARY KEY ("id")
);

-- Add columns to bills
ALTER TABLE "bills"
  ADD COLUMN "one_time_due_id" UUID,
  ADD COLUMN "bill_label" VARCHAR(255);

-- Drop old unique constraint (monthly bills only)
DROP INDEX IF EXISTS "bills_unit_id_period_month_period_year_key";

-- New composite unique: (unit_id, period_month, period_year, one_time_due_id)
-- NULL one_time_due_id = regular bill; UUID = one-time due bill
CREATE UNIQUE INDEX "bills_unit_id_period_month_period_year_one_time_due_id_key"
  ON "bills"("unit_id", "period_month", "period_year", "one_time_due_id")
  NULLS NOT DISTINCT;

-- Index for one_time_due_id lookups
CREATE INDEX "bills_one_time_due_id_idx" ON "bills"("one_time_due_id");

-- Index for association lookups on one_time_dues
CREATE INDEX "one_time_dues_association_id_idx" ON "one_time_dues"("association_id");

-- AddForeignKey: one_time_dues → associations
ALTER TABLE "one_time_dues"
  ADD CONSTRAINT "one_time_dues_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: one_time_dues → users (creator)
ALTER TABLE "one_time_dues"
  ADD CONSTRAINT "one_time_dues_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bills → one_time_dues
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_one_time_due_id_fkey"
  FOREIGN KEY ("one_time_due_id") REFERENCES "one_time_dues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
