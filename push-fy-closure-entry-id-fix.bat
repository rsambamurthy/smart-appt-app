@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Fix closing_entry_id column type (UUID -> VARCHAR) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260731000002_fix_closing_entry_id_type/migration.sql

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "fix: Change closing_entry_id from UUID to VARCHAR(30) — stores reference_code not a UUID"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild and apply the migration. FY Closure should now work. ===
pause
endlocal
