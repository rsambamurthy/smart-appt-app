@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Vendor Service Type master (feature/accounting-v2) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260725000002_add_service_types/migration.sql
git add backend/src/modules/accounting/service-type.service.ts
git add backend/src/modules/accounting/service-type.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add backend/src/modules/accounting/bp-master.service.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/pages/accounting/BusinessPartnersPage.tsx

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat(accounting): Vendor Service Type master — lookup table + vendor form selector"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
echo NOTE: Run migration on Railway console:
echo   npx prisma migrate deploy
pause
endlocal
