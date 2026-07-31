@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: FY Closure fix — run migrations on startup + resilient listFYs ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/Dockerfile
git add backend/src/modules/accounting/fy-closure.service.ts

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "fix: Run prisma migrate deploy on startup; make listFYs resilient before migration runs"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild and apply all pending migrations automatically. ===
pause
endlocal
