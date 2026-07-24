@echo off
echo ============================================================
echo  Pushing: JE Edit button fix + Opening Balance fallback fix
echo ============================================================
echo.
echo  NO SQL required.
echo.
echo  After deployment:
echo  1. Go to Chart of Accounts → click "Sync to Accounting"
echo     The opening balance from Fee Config will now post to
echo     Cash in Hand (DR) / Reserve Fund or OB Equity (CR)
echo.
cd /d "%~dp0"
git add frontend/src/pages/accounting/JournalEntriesPage.tsx
git add backend/src/modules/accounting/journal.service.ts
git commit -m "fix: JE edit button needs icon child; OB sync falls back to 5001 if 5003 missing"
git push
echo.
echo Done!
pause
