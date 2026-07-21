@echo off
setlocal EnableDelayedExpansion
title SmartAppt APK Builder

echo ============================================================
echo   SmartAppt APK Builder
echo ============================================================
echo.

:: ── 1. Find and set Java 17+ ──────────────────────────────────
echo [1/6] Checking Java version...

:: Hardcode Android Studio JBR path
set "JAVA_HOME=E:\Android Studio\jbr"

:: Add Node.js to PATH (try common install locations)
if exist "C:\Program Files\nodejs\npm.cmd" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%APPDATA%\nvm\current\npm.cmd" (
    set "PATH=%APPDATA%\nvm\current;%PATH%"
) else if exist "%ProgramFiles%\nodejs\npm.cmd" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

set "PATH=%JAVA_HOME%\bin;%PATH%"

java -version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: java.exe not found at %JAVA_HOME%\bin
    pause & exit /b 1
)
echo  OK - Java found at %JAVA_HOME%

:: ── 2. Check Android SDK ───────────────────────────────────────
echo.
echo [2/6] Checking Android SDK (ANDROID_HOME)...
if "%ANDROID_HOME%"=="" (
    :: Try default Android Studio location
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
        echo  Found SDK at %LOCALAPPDATA%\Android\Sdk
    ) else (
        echo.
        echo  ERROR: ANDROID_HOME is not set and SDK not found at default location.
        echo  Open Android Studio ^> SDK Manager and note the SDK path,
        echo  then run:  setx ANDROID_HOME "C:\path\to\sdk"
        echo.
        pause & exit /b 1
    )
)
echo  OK - ANDROID_HOME = %ANDROID_HOME%

:: ── 3. Prompt for ngrok URL ────────────────────────────────────
echo.
echo [3/6] Backend API URL setup
echo.
echo  Your backend is running locally. You need ngrok to expose it.
echo  Steps:
echo    a) Open a NEW terminal window
echo    b) Run: ngrok http 3000
echo    c) Copy the https URL shown (e.g. https://abc123.ngrok-free.app)
echo.
set /p NGROK_URL="  Enter your ngrok URL (or press Enter to skip and use placeholder): "

if "%NGROK_URL%"=="" (
    set "NGROK_URL=https://YOUR-NGROK-URL.ngrok-free.app"
    echo  Using placeholder - APK will build but API calls will fail until you update .env.mobile
) else (
    echo  Using: %NGROK_URL%
)

:: Write .env.mobile
echo VITE_API_URL=%NGROK_URL%/api/v1 > frontend\.env.mobile
echo  Written to frontend\.env.mobile

:: ── 4. npm install + build ─────────────────────────────────────
echo.
echo [4/6] Installing packages and building web app...
cd frontend
call npm install
if errorlevel 1 ( echo npm install failed & pause & exit /b 1 )

call npm run build:mobile
if errorlevel 1 ( echo Build failed & pause & exit /b 1 )
echo  Build complete - dist/ folder ready.

:: ── 5. Capacitor: add android + sync ──────────────────────────
echo.
echo [5/6] Setting up Capacitor Android platform...

:: Add android only if not already added
if not exist android (
    call npx cap add android
    if errorlevel 1 ( echo cap add android failed & pause & exit /b 1 )
) else (
    echo  Android platform already exists, skipping add.
)

call npx cap sync android
if errorlevel 1 ( echo cap sync failed & pause & exit /b 1 )
echo  Capacitor sync complete.

:: ── 6. Build APK ───────────────────────────────────────────────
echo.
echo [6/6] Building APK (this takes 2-5 minutes on first run)...
cd android

:: Use gradlew.bat on Windows
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (
    echo.
    echo  Gradle build failed. Common fixes:
    echo    - Make sure Android SDK build-tools are installed
    echo      (Android Studio -^> SDK Manager -^> SDK Tools -^> check "Android SDK Build-Tools")
    echo    - Accept SDK licenses: %ANDROID_HOME%\tools\bin\sdkmanager --licenses
    echo.
    pause & exit /b 1
)

cd ..

:: ── Done ──────────────────────────────────────────────────────
set APK_PATH=frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo ============================================================
echo   SUCCESS! APK built at:
echo   %CD%\%APK_PATH%
echo ============================================================
echo.
echo  To install on your phone:
echo    1. Enable "Install unknown apps" in Android Settings
echo    2. Transfer the APK to your phone (USB / WhatsApp / email)
echo    3. Open the APK file on your phone and install
echo.
echo  Keep ngrok running while using the app!
echo.
explorer /select,"%CD%\%APK_PATH%"
pause
