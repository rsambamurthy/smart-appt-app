@echo off
echo Pushing service request fix...
cd /d "%~dp0"

git add frontend/src/pages/mobile/MobileHomePage.tsx
git add backend/src/modules/maintenance/maintenance.service.ts
git add backend/src/modules/maintenance/maintenance.controller.ts

git commit -m "fix: mobile home counts own tickets (not all); listMine filters by raised_by not unit_id"

git push origin main
echo.
echo Done! Railway will redeploy. Rebuild APK after Railway is up.
pause
