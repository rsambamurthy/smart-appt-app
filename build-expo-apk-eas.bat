@echo off
setlocal
cd /d "%~dp0mobile"
title SmartAppt EAS Cloud APK Builder

echo ============================================================
echo   SmartAppt EAS Cloud APK Builder
echo   Builds a SIGNED APK via Expo's cloud servers.
echo   Requires: Expo account (free at expo.dev)
echo ============================================================
echo.

:: ── Node.js ───────────────────────────────────────────────────
if exist "C:\Program Files\nodejs\npm.cmd" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%APPDATA%\nvm\current\npm.cmd" (
    set "PATH=%APPDATA%\nvm\current;%PATH%"
)

node --version >nul 2>&1
if errorlevel 1 ( echo ERROR: Node.js not found & pause & exit /b 1 )

:: ── Install eas-cli if missing ────────────────────────────────
where eas >nul 2>&1
if errorlevel 1 (
    echo Installing EAS CLI...
    call npm install -g eas-cli
    if errorlevel 1 ( echo ERROR: Could not install eas-cli & pause & exit /b 1 )
)
echo [OK] EAS CLI ready.

:: ── npm install ───────────────────────────────────────────────
echo.
echo Installing npm dependencies...
call npm install --legacy-peer-deps
if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )

:: ── EAS login ─────────────────────────────────────────────────
echo.
echo Logging in to Expo (browser will open)...
call eas login
if errorlevel 1 ( echo ERROR: EAS login failed & pause & exit /b 1 )

:: ── Configure EAS project (first time only) ───────────────────
if not exist "eas.json" (
    echo.
    echo Configuring EAS project...
    call eas build:configure
)

:: ── Trigger preview build (APK) ───────────────────────────────
echo.
echo ============================================================
echo   Starting cloud APK build (profile: preview)
echo   This builds a signed APK — takes ~5-10 minutes in cloud.
echo   You will get a download link when done.
echo ============================================================
echo.

call eas build --platform android --profile preview --non-interactive
if errorlevel 1 (
    echo ERROR: EAS build failed.
    echo   Check https://expo.dev for build logs.
    pause & exit /b 1
)

echo.
echo ============================================================
echo   Build submitted! Monitor at: https://expo.dev/builds
echo   When complete, download the APK from the Expo dashboard.
echo ============================================================
pause
endlocal
