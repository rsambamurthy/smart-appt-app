@echo off
echo === Journal Entry + Auto-Post — push to git ===

git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260723000004_journal_entries/migration.sql
git add backend/src/modules/accounting/journal.schema.ts
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/accounting/journal.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/expenses/expenses.service.ts
git add backend/src/modules/receipts/receipts.service.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/pages/accounting/JournalEntriesPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx

git commit -m "feat: Journal entries with auto-post (dues, payments, expenses, receipts)"
git push

echo.
echo === Done. Railway will now build. ===
echo.
echo === Run this SQL on Railway BEFORE the build completes: ===
echo.
echo CREATE TYPE "JournalEntryType" AS ENUM ('AUTO', 'MANUAL');
echo.
echo CREATE TABLE "journal_entries" (
echo   "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
echo   "association_id" UUID         NOT NULL,
echo   "entry_date"     DATE         NOT NULL,
echo   "narration"      VARCHAR(255) NOT NULL,
echo   "reference_type" VARCHAR(50),
echo   "reference_id"   UUID,
echo   "type"           "JournalEntryType" NOT NULL DEFAULT 'MANUAL',
echo   "created_by"     UUID,
echo   "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
echo   CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
echo   CONSTRAINT "journal_entries_association_id_fkey" FOREIGN KEY ("association_id")
echo     REFERENCES "associations"("id") ON DELETE CASCADE
echo );
echo.
echo CREATE INDEX "journal_entries_association_id_entry_date_idx"
echo   ON "journal_entries"("association_id", "entry_date" DESC);
echo.
echo CREATE TABLE "journal_lines" (
echo   "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
echo   "journal_entry_id" UUID          NOT NULL,
echo   "account_id"       UUID          NOT NULL,
echo   "debit"            DECIMAL(12,2) NOT NULL DEFAULT 0,
echo   "credit"           DECIMAL(12,2) NOT NULL DEFAULT 0,
echo   "narration"        VARCHAR(255),
echo   CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
echo   CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id")
echo     REFERENCES "journal_entries"("id") ON DELETE CASCADE,
echo   CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id")
echo     REFERENCES "accounts"("id")
echo );
echo.
pause
