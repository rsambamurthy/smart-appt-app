@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Mobile App Configuration matrix (backend + frontend) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260731000003_add_mobile_menu_items/migration.sql
git add backend/src/modules/system/system.service.ts
git add frontend/src/store/api/systemApi.ts
git add frontend/src/contexts/MobileConfigContext.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/App.tsx
git add frontend/src/pages/admin/MobileConfigPage.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx
git add railway-apply-fy-migrations.sql

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat: Mobile App Config matrix — per-menu-item enabled/can_post control for Super User"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done! ===
echo.
echo IMPORTANT — run railway-apply-fy-migrations.sql in Railway Postgres console if not done yet.
echo It now also adds the menu_items column to mobile_config.
echo.
echo After Railway deploys, go to:
echo   System Settings ^> Mobile App Config
echo to configure the mobile menu matrix per association.
pause
endlocal
