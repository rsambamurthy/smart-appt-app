@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Fix Prisma DbNull type error for menu_items ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

git add backend/src/modules/system/system.service.ts

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "fix: Use Prisma.DbNull for nullable JSON menu_items field in saveMobileConfig"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done! Railway will rebuild. ===
pause
endlocal
