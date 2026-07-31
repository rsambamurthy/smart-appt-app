@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Bank Upload + Bulk Payment Upload + Accounting Polish (feature/accounting-v2) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/src/modules/accounting/bank-upload.service.ts
git add backend/src/modules/accounting/bank-upload.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/BusinessPartnersPage.tsx
git add frontend/index.html
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/accounting/LedgerPage.tsx
git add backend/src/modules/accounting/journal.service.ts
git add frontend/src/pages/dues/DuesConfigPage.tsx
git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/dues/payment-upload.service.ts
git add backend/src/modules/dues/payment-upload.controller.ts
git add backend/src/modules/dues/dues.routes.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/pages/dues/DuesBillsPage.tsx

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat: Bulk payment upload, bank upload, accordion polish, nav restructure, ledger OB, auto-JE sync"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
pause
endlocal
