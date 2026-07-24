@echo off
echo ============================================================
echo  Pushing: Accounting Fixes — Expense sync + Unit narrations
echo ============================================================
echo.
echo  NO SQL required for this push.
echo.
cd /d "%~dp0"
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/dues/dues.service.ts
git commit -m "fix: sync all non-rejected expenses in backfill; include flat number in bill/payment journal narrations"
git push
echo.
echo Done!
pause
