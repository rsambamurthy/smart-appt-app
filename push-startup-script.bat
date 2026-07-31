@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Fix startup — use explicit prisma binary in start.sh ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/Dockerfile
git add backend/start.sh

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "fix: Use start.sh with explicit prisma binary path so migrations always run on startup"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild. Watch deploy logs for '=== Migrations done ===' ===
pause
endlocal
