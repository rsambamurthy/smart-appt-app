@echo off
echo Pushing mobile APK infrastructure...
cd /d "%~dp0"

git add frontend/src/hooks/usePlatform.ts
git add frontend/src/contexts/MobileConfigContext.tsx
git add frontend/src/components/organisms/MobileLayout.tsx
git add frontend/src/pages/mobile/MobileHomePage.tsx
git add frontend/src/pages/mobile/MobileMorePage.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/App.tsx

git commit -m "feat: mobile APK shell — MobileLayout, MobileHomePage, MobileMorePage, platform-aware routing in App.tsx + Layout.tsx passthrough"

git push origin main
echo.
echo Done! Run build-apk.bat to build the APK.
pause
