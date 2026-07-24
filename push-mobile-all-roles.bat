@echo off
echo Pushing mobile all-roles fix (no role restrictions anywhere)...
cd /d "%~dp0"

git add frontend/src/pages/mobile/MobileBillsPage.tsx
git add frontend/src/pages/mobile/MobileVisitorsPage.tsx
git add backend/src/modules/dues/dues.routes.ts
git add backend/src/modules/visitors/visitors.routes.ts

git commit -m "fix: mobile shows resident experience for all roles; open bills/visitor backend routes to all authenticated users"

git push origin main
echo.
echo Done! Run build-apk.bat to rebuild the APK.
pause
