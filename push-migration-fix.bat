@echo off
setlocal
echo ============================================================
echo  Fix Railway migration error P3005 (schema not empty)
echo ============================================================
echo.
echo  What this does:
echo   - start.sh now self-heals when Prisma has no migration history
echo   - applies the 2 new additive migrations directly (idempotent SQL)
echo   - baselines all 24 migrations so future deploys are clean
echo.

cd /d "%~dp0"

if exist ".git\index.lock" (
  tasklist /fi "imagename eq git.exe" 2>nul | find /i "git.exe" >nul
  if errorlevel 1 (
    del /f /q ".git\index.lock"
    echo   Removed stale git lock.
  ) else (
    echo   ERROR: git.exe is running. Close it and retry.
    pause & exit /b 1
  )
)

git add backend/start.sh
git commit -m "fix: self-healing migrations on startup (baseline P3005 + apply additive DDL)"

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo   Pushing branch: %BRANCH%
git push origin HEAD
if errorlevel 1 (
  echo   ERROR: git push failed.
  pause & exit /b 1
)

echo.
echo ============================================================
echo  Pushed. Watch the Railway deploy logs for:
echo ============================================================
echo.
echo    === Attempting automatic baseline + additive repair ===
echo    --- applying prisma/migrations/20260801000003_.../migration.sql
echo        ok
echo    --- applying prisma/migrations/20260801000004_.../migration.sql
echo        ok
echo    --- baselining migration history
echo    === Migrations healthy ===
echo.
echo  Then verify in the webapp:
echo    Fee Configuration  - Cash Opening Balance card is gone
echo    Accounting/Ledger  - Sub-Ledger has an account picker
echo.
pause
