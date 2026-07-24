@echo off
echo Pushing mobile feedback fixes...
cd /d "%~dp0"

git add backend/src/modules/auth/auth.service.ts
git add frontend/src/features/auth/authSlice.ts
git add frontend/src/pages/mobile/MobileHomePage.tsx
git add frontend/src/pages/mobile/MobileMorePage.tsx
git add frontend/src/pages/mobile/MobileVisitorsPage.tsx
git add frontend/src/App.tsx
git add frontend/src/pages/maintenance/TicketListPage.tsx

git commit -m "feat: mobile feedback - association+unit in header, raise request for all roles, visitors hub, logout on top, fix 4-digit PIN label"

git push origin main
echo.
echo Done! Run build-apk.bat to rebuild the APK.
pause
