@echo off
echo Pushing resident-role fix - Manager/Committee/Treasurer get all Resident features...
cd /d "%~dp0"

git add frontend/src/constants/roles.ts
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/DashboardPage.tsx
git add frontend/src/pages/maintenance/TicketListPage.tsx
git add frontend/src/pages/maintenance/TicketDetailPage.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx
git add backend/src/modules/maintenance/maintenance.routes.ts

git commit -m "feat: Manager/Committee/Treasurer inherit all Resident features on web and mobile"

git push origin main
echo.
echo Done! Railway will redeploy. No APK rebuild needed - only backend/web changes.
pause
