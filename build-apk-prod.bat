@echo off
setlocal EnableDelayedExpansion
title SmartAppt Production APK Builder

echo ============================================================
echo   SmartAppt Production APK Builder
echo   API: https://smart-appt-app-production.up.railway.app
echo ============================================================
echo.

:: ── Java ──────────────────────────────────────────────────────
set "JAVA_HOME=E:\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

if exist "C:\Program Files\nodejs\npm.cmd" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%APPDATA%\nvm\current\npm.cmd" (
    set "PATH=%APPDATA%\nvm\current;%PATH%"
)

java -version >nul 2>&1
if errorlevel 1 ( echo ERROR: Java not found at %JAVA_HOME% & pause & exit /b 1 )
echo [OK] Java found.

:: ── Android SDK ───────────────────────────────────────────────
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    ) else (
        echo ERROR: ANDROID_HOME not set. & pause & exit /b 1
    )
)
echo [OK] ANDROID_HOME = %ANDROID_HOME%

:: ── Use production .env.mobile (already set to Railway URL) ───
echo.
echo [1/4] Using production API URL from frontend\.env.mobile...
echo   VITE_API_URL=https://smart-appt-app-production.up.railway.app/api/v1
copy /Y frontend\.env.mobile frontend\.env.local >nul
echo [OK] .env.local written.

:: ── Build web app ─────────────────────────────────────────────
echo.
echo [2/4] Building frontend (production mode)...
cd frontend
call npm run build:mobile
if errorlevel 1 ( echo Build failed & pause & exit /b 1 )
echo [OK] dist/ ready.

:: ── Capacitor sync ────────────────────────────────────────────
echo.
echo [3/4] Syncing Capacitor...
if not exist android (
    call npx cap add android
    if errorlevel 1 ( echo cap add android failed & pause & exit /b 1 )
)
call npx cap sync android
if errorlevel 1 ( echo cap sync failed & pause & exit /b 1 )
echo [OK] Capacitor sync complete.

:: ── Gradle build ──────────────────────────────────────────────
echo.
echo [4/4] Building APK (2-5 min first run)...
cd android
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (
    echo.
    echo  Gradle failed. Try: %ANDROID_HOME%\tools\bin\sdkmanager --licenses
    pause & exit /b 1
)
cd ..\..

:: ── Done ──────────────────────────────────────────────────────
set APK_PATH=frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo ============================================================
echo   SUCCESS!
echo   APK: %CD%\%APK_PATH%
echo   API: https://smart-appt-app-production.up.railway.app
echo ============================================================
echo.
echo  Install on phone:
echo    1. Settings ^> Install unknown apps ^> allow
echo    2. Transfer APK via USB / WhatsApp / email
echo    3. Tap to install
echo.
explorer /select,"%CD%\%APK_PATH%"
pause
