@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Fix groupBy TypeScript error in fy-closure.service.ts ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/src/modules/accounting/fy-closure.service.ts

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "fix: Replace groupBy with findMany+distinct in listFYs to fix TS2345 build error"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
pause
endlocal
