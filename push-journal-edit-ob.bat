@echo off
echo ============================================================
echo  Pushing: Opening Balance fix + Journal Entry Edit
echo ============================================================
echo.
echo  ACTION REQUIRED after deployment:
echo  1. Go to Chart of Accounts and click "Seed Default Accounts"
echo     (adds new account 5003 - Opening Balance Equity)
echo  2. Go to Chart of Accounts and run "Sync to Accounting"
echo     (backfill will now also post the Opening Balance entry)
echo.
cd /d "%~dp0"
git add backend/src/modules/accounting/accounting.service.ts
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/accounting/journal.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add backend/src/modules/dues/dues.service.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/JournalEntriesPage.tsx
git commit -m "feat: opening balance syncs to Cash in Hand journal; edit any journal entry"
git push
echo.
echo Done!
pause
