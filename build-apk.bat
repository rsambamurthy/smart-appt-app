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

:: ── 3. Backend API URL ──────────────────────────────────────────
echo.
echo [3/6] Backend API URL setup
echo.

:: Re-use .env.mobile if it already has a real URL
set "EXISTING_URL="
if exist "frontend\.env.mobile" (
    for /f "tokens=2 delims==" %%A in ('findstr "VITE_API_URL" "frontend\.env.mobile"') do set "EXISTING_URL=%%A"
)

if not "%EXISTING_URL%"=="" (
    echo  Found existing API URL: %EXISTING_URL%
    set /p CHANGE_URL="  Press Enter to keep it, or type a new Railway URL to override: "
    if "!CHANGE_URL!"=="" (
        echo  Keeping existing URL.
        goto :url_done
    )
    set "RAILWAY_URL=!CHANGE_URL!"
) else (
    echo  Your backend is deployed on Railway.
    echo  Example: https://smart-appt-production.up.railway.app
    echo.
    set /p RAILWAY_URL="  Enter your Railway backend URL: "
)

if "!RAILWAY_URL!"=="" (
    echo  ERROR: Railway URL is required.
    pause & exit /b 1
)

:: Strip trailing slash if present
if "!RAILWAY_URL:~-1!"=="/" set "RAILWAY_URL=!RAILWAY_URL:~0,-1!"

:: Auto-prepend https:// if missing
echo !RAILWAY_URL! | findstr /i "^https://" >nul
if errorlevel 1 set "RAILWAY_URL=https://!RAILWAY_URL!"

echo VITE_API_URL=!RAILWAY_URL!/api/v1 > frontend\.env.mobile
echo  Written to frontend\.env.mobile (VITE_API_URL=!RAILWAY_URL!/api/v1)

:url_done

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
set APK_PATH=frontend\android\app\build\outputs\apk\debug\SmartAppt.apk
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
echo  Backend is on Railway - no ngrok needed!
echo.
explorer /select,"%CD%\%APK_PATH%"
pause
