@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Vendor Bulk Upload (feature/accounting-v2) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/src/modules/accounting/vendor-upload.service.ts
git add backend/src/modules/accounting/vendor-upload.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/BusinessPartnersPage.tsx

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat(accounting): Vendor bulk upload — Excel template with service type dropdown, preview, apply"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
pause
endlocal
