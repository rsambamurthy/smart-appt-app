@echo off
echo ============================================================
echo  Pushing P^&L (Profit ^& Loss) page
echo ============================================================
echo.
echo  NO SQL required for this push.
echo  (P^&L uses journal_entries and journal_lines tables already created.)
echo.
cd /d "%~dp0"
git add frontend/src/pages/accounting/PnLPage.tsx
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx
git commit -m "feat: add P&L statement page + accountingApi getPnL endpoint"
git push
echo.
echo Done!
pause
