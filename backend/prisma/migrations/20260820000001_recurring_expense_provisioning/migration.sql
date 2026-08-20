-- CreateEnum: ProvisionStatus
CREATE TYPE "ProvisionStatus" AS ENUM ('OPEN', 'SETTLED', 'REVERSED');

-- AddColumn: opt-in month-end accrual flag on recurring_expenses
ALTER TABLE "recurring_expenses"
    ADD COLUMN "auto_provision" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: expense_provisions — one row per (recurring expense, month)
-- that was accrued at month-end instead of waiting for the real invoice.
CREATE TABLE "expense_provisions" (
    "id"                            UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id"                UUID NOT NULL,
    "recurring_expense_id"          UUID NOT NULL,
    "period_year"                   SMALLINT NOT NULL,
    "period_month"                  SMALLINT NOT NULL,
    "amount"                        DECIMAL(10,2) NOT NULL,
    "status"                        "ProvisionStatus" NOT NULL DEFAULT 'OPEN',
    "provisioning_journal_entry_id" UUID,
    "settled_expense_id"            UUID,
    "settlement_journal_entry_id"   UUID,
    "settled_at"                    TIMESTAMPTZ,
    "created_at"                    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                    TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_provisions_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex: at most one provision per recurring expense per calendar month
CREATE UNIQUE INDEX "expense_provisions_recurring_expense_id_period_year_period_mo"
    ON "expense_provisions"("recurring_expense_id", "period_year", "period_month");

-- UniqueIndex: an Expense can settle at most one provision
CREATE UNIQUE INDEX "expense_provisions_settled_expense_id_key"
    ON "expense_provisions"("settled_expense_id");

-- Index: review screen — open/settled provisions per association
CREATE INDEX "expense_provisions_association_id_status_idx"
    ON "expense_provisions"("association_id", "status");

-- FK: expense_provisions → associations
ALTER TABLE "expense_provisions"
    ADD CONSTRAINT "expense_provisions_association_id_fkey"
    FOREIGN KEY ("association_id")
    REFERENCES "associations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: expense_provisions → recurring_expenses
ALTER TABLE "expense_provisions"
    ADD CONSTRAINT "expense_provisions_recurring_expense_id_fkey"
    FOREIGN KEY ("recurring_expense_id")
    REFERENCES "recurring_expenses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: expense_provisions.settled_expense_id → expenses (soft link elsewhere
-- in this schema, e.g. journal_entries.reference_id, is intentionally left
-- without a DB constraint; this one gets a real FK since it drives the
-- one-provision-per-expense uniqueness above).
ALTER TABLE "expense_provisions"
    ADD CONSTRAINT "expense_provisions_settled_expense_id_fkey"
    FOREIGN KEY ("settled_expense_id")
    REFERENCES "expenses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: expense_provisions.provisioning_journal_entry_id → journal_entries
ALTER TABLE "expense_provisions"
    ADD CONSTRAINT "expense_provisions_provisioning_journal_entry_id_fkey"
    FOREIGN KEY ("provisioning_journal_entry_id")
    REFERENCES "journal_entries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: expense_provisions.settlement_journal_entry_id → journal_entries
ALTER TABLE "expense_provisions"
    ADD CONSTRAINT "expense_provisions_settlement_journal_entry_id_fkey"
    FOREIGN KEY ("settlement_journal_entry_id")
    REFERENCES "journal_entries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
