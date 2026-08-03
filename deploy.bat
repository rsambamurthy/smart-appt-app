@echo off
setlocal EnableDelayedExpansion
title SmartAppt — Deploy
cd /d "%~dp0"

:: ============================================================================
::  The only deploy script.
::
::  Commits tracked changes and pushes to the current branch. Railway redeploys
::  the backend and Vercel the web app, both automatically.
::
::  Usage:  deploy.bat "fix: gate console restricted to gate staff"
::          deploy.bat            (prompts for the message)
::
::  WHY IT ONLY STAGES TRACKED FILES
::  It runs `git add -u`, never `git add -A` or `git add .`. That stages edits
::  and deletions to files already in the repo, and cannot pick up anything
::  new. The working tree holds migration dumps with residents' names, phone
::  numbers and M-PIN hashes; one absent-minded `git add .` puts them on
::  GitHub permanently. New files are listed below for you to add by hand,
::  deliberately, one at a time.
:: ============================================================================

echo ============================================================
echo   SmartAppt — Deploy
echo ============================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 ( echo   ERROR: not a git repository. & pause & exit /b 1 )

:: ── Stale lock files ─────────────────────────────────────────────────────────
:: A crashed editor leaves these behind and every git command then fails with
:: an unhelpful message. Only clear them when git is genuinely not running.
if exist ".git\index.lock" (
    tasklist /fi "imagename eq git.exe" 2>nul | find /i "git.exe" >nul
    if not errorlevel 1 (
        echo   ERROR: git.exe is running. Close it and retry.
        pause & exit /b 1
    )
    del /f /q ".git\index.lock" 2>nul
    echo   Cleared a stale git lock.
)

:: ── Branch ───────────────────────────────────────────────────────────────────
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo   Branch: !BRANCH!
echo.

:: ── Stage tracked changes only ───────────────────────────────────────────────
git add -u

git diff --cached --quiet
if not errorlevel 1 (
    echo   Nothing to deploy — no changes to tracked files.
    echo.
    goto :show_untracked
)

echo   Staged for this deploy:
echo   ------------------------------------------------------------
git diff --cached --name-status
echo   ------------------------------------------------------------
echo.

:: ── New files are NOT staged, and that trips people up ───────────────────────
:: `git add -u` cannot pick up untracked files. That is deliberate — it is what
:: stops a migration dump full of residents' phone numbers reaching GitHub. But
:: it also means a new source file is silently left behind, and the build fails
:: minutes later with "Cannot find module". So they are shown BEFORE the commit,
:: while you can still do something about it.
git ls-files --others --exclude-standard --directory > "%TEMP%\sa_untracked.txt"
for /f %%A in ('type "%TEMP%\sa_untracked.txt" ^| find /c /v ""') do set "UNTRACKED=%%A"

if not "%UNTRACKED%"=="0" (
    echo   ============================================================
    echo   %UNTRACKED% NEW file^(s^) will NOT be deployed:
    echo   ============================================================
    type "%TEMP%\sa_untracked.txt"
    echo   ------------------------------------------------------------
    echo.
    echo   If your change added new source files, they are in that list
    echo   and the build WILL fail without them. Add them first:
    echo.
    echo       git add ^<path^>
    echo.
    set /p "GOON=  Continue without them? [y/N] "
    if /i not "!GOON!"=="y" (
        echo   Stopped. Nothing committed.
        git reset >nul
        del "%TEMP%\sa_untracked.txt" >nul 2>&1
        pause & exit /b 0
    )
)
del "%TEMP%\sa_untracked.txt" >nul 2>&1
echo.

:: ── Safety net ───────────────────────────────────────────────────────────────
:: .gitignore should already stop these. This catches the case where one was
:: committed before the ignore rule existed, since .gitignore does not apply
:: to files git is already tracking.
git diff --cached --name-only | findstr /i "import-to-gold export-from-lite scripts/migration" >nul
if not errorlevel 1 (
    echo   ============================================================
    echo   ABORTED — resident data in the staged changes.
    echo   ============================================================
    echo.
    echo   One of the files above looks like a migration dump. Those
    echo   contain real names, phone numbers and M-PIN hashes.
    echo.
    echo   Unstage it, then run:  git rm --cached ^<file^>
    echo.
    git reset >nul
    pause & exit /b 1
)

:: ── Message ──────────────────────────────────────────────────────────────────
set "MSG=%~1"
if "!MSG!"=="" (
    echo   Commit message ^(describe what changed^):
    set /p "MSG=  > "
)
if "!MSG!"=="" (
    echo   ERROR: a commit message is required.
    git reset >nul
    pause & exit /b 1
)

echo.
git commit -m "!MSG!"
if errorlevel 1 (
    echo   ERROR: commit failed.
    pause & exit /b 1
)

:: ── Push ─────────────────────────────────────────────────────────────────────
echo.
echo   Pushing to origin/!BRANCH! ...
git push origin HEAD
if errorlevel 1 (
    echo.
    echo   ERROR: push failed. Nothing has been deployed.
    echo   If it was rejected, someone else pushed first:  git pull --rebase
    pause & exit /b 1
)

echo.
echo ============================================================
echo   Pushed. Railway and Vercel redeploy in about 2 minutes.
echo ============================================================
echo.
echo   Watch the Railway build log before testing. If the backend
echo   fails to compile, the old version keeps serving and your
echo   changes are simply absent — which looks like a bug in the
echo   app rather than a failed deploy.
echo.
echo   Changed anything under frontend\ ? The web app updates on
echo   its own, but the APK does not. Run build-apk-prod.bat.
echo.

:show_untracked
echo   ------------------------------------------------------------
echo   Still untracked (not deployed):
echo   ------------------------------------------------------------
git ls-files --others --exclude-standard --directory
echo   ------------------------------------------------------------
echo.
pause
endlocal
