@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Baseline Version 2 as SmartAppt Gold ===
echo.

:: Remove stale lock file if present
if exist ".git\index.lock" (
    echo Removing stale git lock file...
    del /f ".git\index.lock"
)

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch branch & pause & exit /b 1 )

echo --- Staging all changes ---
git add -A

git status
echo.
echo Changes staged. Press any key to commit, or Ctrl+C to abort.
pause > nul

git commit -m "chore: Rebrand as SmartAppt Gold + SmartAppt Lite (Expo) — v2.0 baseline"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

echo.
echo --- Creating v2.0-baseline tag (SmartAppt Gold) ---
git tag -a v2.0-baseline -m "SmartAppt Gold — Version 2.0 baseline. Full accounting suite + mobile config matrix + Expo Lite app."
if errorlevel 1 ( echo ERROR: tag failed & pause & exit /b 1 )

echo.
echo --- Pushing branch and tag to origin ---
git push origin feature/accounting-v2
git push origin v2.0-baseline
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo ============================================================
echo   Done!
echo.
echo   Git baselines:
echo     v1.0-baseline  =  SmartAppt Lite  (original app)
echo     v2.0-baseline  =  SmartAppt Gold  (full accounting suite)
echo.
echo   Next: create the new Railway project "SmartAppt" and
echo   connect it to the feature/accounting-v2 branch.
echo ============================================================
pause
endlocal
