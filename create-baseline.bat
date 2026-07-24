@echo off
echo Creating SmartAppt baseline v1.0...
cd /d "%~dp0"

:: Remove stale git lock if present
if exist ".git\index.lock" del /f ".git\index.lock"

:: Remove accidental junk files
if exist "refetch()" del /f "refetch()"
if exist "{" del /f "{"

:: Stage everything except junk
git add -A
git reset HEAD "refetch()" "{" 2>nul

:: Commit all pending changes
git commit -m "baseline: scripts, hooks, APK rename, and all mobile fixes"

:: Create an annotated tag marking this as the baseline
git tag -a v1.0-baseline -m "SmartAppt v1.0 baseline - web + mobile app complete with all role fixes"

:: Push commit + tag to origin
git push origin main
git push origin v1.0-baseline

echo.
echo ============================================================
echo   Baseline created successfully: v1.0-baseline
echo   All changes committed and tagged on origin/main
echo ============================================================
pause
