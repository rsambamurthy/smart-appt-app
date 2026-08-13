@echo off
setlocal
echo ============================================================
echo  SmartAppt — Fix: Insights stuck on "Loading insights..."
echo ============================================================
echo.
echo  Cause 1 (UI):  the page only handled loading and success, so
echo                 a failed request span forever. It now shows the
echo                 server's actual error with a Retry button.
echo.
echo  Cause 2 (SQL): the queries used make_interval(months =^> $1).
echo                 Passing a bound integer into a named interval
echo                 argument can fail type resolution in Postgres.
echo                 All 8 occurrences replaced — the date window is
echo                 now computed in JS and passed as a timestamp.
echo.
echo  Also added:    backend logs "INSIGHTS QUERY FAILED" with the
echo                 real Postgres error if anything still breaks.
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

echo [1/1] Committing and pushing...

git add backend/src/ frontend/src/ mobile-gold/ backend/scripts/

git commit -m "fix(insights): show API errors instead of infinite spinner; replace make_interval with JS-computed date window"
if errorlevel 1 echo   (nothing new to commit)

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo   Pushing branch: %BRANCH%
git push origin HEAD
if errorlevel 1 (
  echo   ERROR: git push failed.
  pause & exit /b 1
)

echo.
echo ============================================================
echo  After deploy, reload Reports - Insights:
echo ============================================================
echo.
echo   - If it loads: done.
echo   - If it shows a red error box: paste that message here.
echo   - Also check Railway logs for "INSIGHTS QUERY FAILED",
echo     which carries the exact SQL error.
echo.
pause
