@echo off
echo Pushing manager role mobile improvements...
cd /d "%~dp0"

git add frontend/src/pages/mobile/MobileHomePage.tsx
git add frontend/src/pages/mobile/MobileMorePage.tsx
git add frontend/src/App.tsx

git commit -m "fix: add manager quick actions and routes to mobile app"

git push origin main
echo.
echo Done! Run build-apk.bat to rebuild.
pause
