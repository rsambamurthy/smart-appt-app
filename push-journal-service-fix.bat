@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
git checkout feature/accounting-v2
echo Pushing journal.service.ts fix for accounting-v2 schema...
git add backend/src/modules/accounting/journal.service.ts
git commit -m "fix(accounting-v2): update journal.service.ts for new schema — JournalEntrySource, VoucherType, reference_code, financial_year"
git push origin feature/accounting-v2
echo Done. Railway dev will rebuild automatically.
pause
