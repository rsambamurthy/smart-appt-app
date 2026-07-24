@echo off
echo ============================================================
echo  Pushing Balance Sheet
echo ============================================================
echo.
echo  NO SQL required for this push.
echo  (Balance Sheet reads from existing accounts, journal_entries,
echo   and journal_lines tables.)
echo.
cd /d "%~dp0"
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/accounting/journal.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/BalanceSheetPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx
git commit -m "feat: add Balance Sheet (as-of snapshot with balance check)"
git push
echo.
echo Done!
pause
