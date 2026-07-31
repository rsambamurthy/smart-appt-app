@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: FY Configuration + Year Closure Processing ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260731000001_add_fy_closure/migration.sql
git add backend/src/modules/accounting/fy-closure.service.ts
git add backend/src/modules/accounting/fy-closure.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add backend/src/modules/accounting/journal.service.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/FYClosurePage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat: Financial Year configuration + Year Closure processing (preview, close, reopen, locked-year guard)"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
pause
endlocal
