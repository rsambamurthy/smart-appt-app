@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Expo Mobile App scaffold ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage all mobile files ---
git add mobile/

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat: Expo React Native mobile app with dynamic nav driven by mobile config"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done! ===
echo.
echo Next steps:
echo   cd mobile
echo   npm install
echo   Edit src/api/client.ts and set your Railway backend URL
echo   npm run android   (or npm run ios on macOS)
echo.
echo See mobile/SETUP.md for full instructions.
pause
endlocal
