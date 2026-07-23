-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable: journal_entries
CREATE TABLE "journal_entries" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID         NOT NULL,
  "entry_date"     DATE         NOT NULL,
  "narration"      VARCHAR(255) NOT NULL,
  "reference_type" VARCHAR(50),
  "reference_id"   UUID,
  "type"           "JournalEntryType" NOT NULL DEFAULT 'MANUAL',
  "created_by"     UUID,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_entries_association_id_fkey" FOREIGN KEY ("association_id")
    REFERENCES "associations"("id") ON DELETE CASCADE
);

CREATE INDEX "journal_entries_association_id_entry_date_idx"
  ON "journal_entries"("association_id", "entry_date" DESC);

-- CreateTable: journal_lines
CREATE TABLE "journal_lines" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "journal_entry_id" UUID          NOT NULL,
  "account_id"       UUID          NOT NULL,
  "debit"            DECIMAL(12,2) NOT NULL DEFAULT 0,
  "credit"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "narration"        VARCHAR(255),

  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id")
    REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id")
    REFERENCES "accounts"("id")
);
