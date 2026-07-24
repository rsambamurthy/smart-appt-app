@echo off
echo Pushing mobile routing fix...
cd /d "%~dp0"

git add frontend/src/pages/LoginPage.tsx
git add frontend/src/App.tsx

git commit -m "fix: mobile routing — redirect to /mobile/home on native, guard all web routes with !IS_NATIVE"

git push origin main
echo.
echo Done! Now run build-apk.bat to rebuild.
pause
