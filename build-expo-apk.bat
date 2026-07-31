@echo off
setlocal EnableDelayedExpansion
title SmartAppt Expo APK Builder (Local)

echo ============================================================
echo   SmartAppt Expo APK Builder
echo   Backend: https://smart-appt-app-production.up.railway.app
echo   Method:  Local Gradle (no Expo account needed)
echo ============================================================
echo.

:: ── Java (Android Studio JBR) ─────────────────────────────────
set "JAVA_HOME=E:\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java not found at %JAVA_HOME%\bin
    echo   Make sure Android Studio is installed at E:\Android Studio
    pause & exit /b 1
)
echo [OK] Java found.

:: ── Node.js ───────────────────────────────────────────────────
if exist "C:\Program Files\nodejs\npm.cmd" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%APPDATA%\nvm\current\npm.cmd" (
    set "PATH=%APPDATA%\nvm\current;%PATH%"
)

node --version >nul 2>&1
if errorlevel 1 ( echo ERROR: Node.js not found in PATH & pause & exit /b 1 )
echo [OK] Node.js found.

:: ── Android SDK ───────────────────────────────────────────────
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    ) else if exist "C:\Users\%USERNAME%\AppData\Local\Android\Sdk" (
        set "ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
    ) else (
        echo ERROR: ANDROID_HOME not set. Open Android Studio and install SDK.
        pause & exit /b 1
    )
)
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%"
echo [OK] ANDROID_HOME = %ANDROID_HOME%

:: ── Change to mobile directory ────────────────────────────────
cd /d "%~dp0mobile"
echo [OK] Working in: %CD%

:: ── Step 1: Install npm dependencies ─────────────────────────
echo.
echo [1/4] Installing npm dependencies...
call npm install --legacy-peer-deps
if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )
echo [OK] Dependencies installed.

:: ── Step 2: Expo prebuild ─────────────────────────────────────
echo.
echo [2/4] Running expo prebuild (generates Android project)...
echo   This may take a minute on first run...
call npx expo prebuild --platform android --clean
if errorlevel 1 ( echo ERROR: expo prebuild failed & pause & exit /b 1 )
echo [OK] Android project generated in mobile\android\

:: ── Step 3: Build debug APK ───────────────────────────────────
echo.
echo [3/4] Building Debug APK with Gradle...
echo   (Use debug for testing — no signing needed)
cd android

:: Use gradlew.bat if it exists, otherwise generate wrapper
if not exist "gradlew.bat" (
    echo ERROR: gradlew.bat not found. Prebuild may have failed.
    pause & exit /b 1
)

call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 ( echo ERROR: Gradle build failed & pause & exit /b 1 )

:: ── Step 4: Copy APK ──────────────────────────────────────────
echo.
echo [4/4] Copying APK...
set "APK_SRC=app\build\outputs\apk\debug\app-debug.apk"
set "APK_DST=%~dp0SmartAppt-debug.apk"

if exist "%APK_SRC%" (
    copy /Y "%APK_SRC%" "%APK_DST%" >nul
    echo.
    echo ============================================================
    echo   SUCCESS!
    echo   APK: %APK_DST%
    echo ============================================================
    echo.
    echo   Install on your phone:
    echo     1. Enable "Install unknown apps" in Android settings
    echo     2. Transfer SmartAppt-debug.apk to your phone
    echo     3. Open the file on your phone to install
    echo   OR connect USB and run:
    echo     adb install SmartAppt-debug.apk
    echo.
) else (
    echo ERROR: APK not found at expected path.
    echo   Check: %CD%\%APK_SRC%
)

pause
endlocal
