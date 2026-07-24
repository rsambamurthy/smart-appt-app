@echo off
echo ============================================================
echo  Pushing: Accounting Sync + Menu Config Update
echo ============================================================
echo.
echo  NO SQL required for this push.
echo.
cd /d "%~dp0"
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/accounting/journal.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/ChartOfAccountsPage.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx
git commit -m "feat: backfill historical transactions to accounting + add Accounting to menu config"
git push
echo.
echo Done!
pause
