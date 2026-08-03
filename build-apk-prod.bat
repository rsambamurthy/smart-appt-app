@echo off
setlocal EnableDelayedExpansion
title SmartAppt Gold APK Builder
cd /d "%~dp0"

:: ============================================================================
::  The only APK build script. Builds the Capacitor app from frontend\ and
::  points it at the SmartAppt Gold backend.
::
::  The API URL is baked in at build time from frontend\.env.mobile. Get it
::  wrong and nothing fails: the app builds, installs and launches, then tells
::  real users their account does not exist, because it is asking the wrong
::  database. That happened once. Hence the check below rather than a comment
::  asking someone to remember.
:: ============================================================================

set "EXPECTED_HOST=smart-appt-app-development.up.railway.app"

echo ============================================================
echo   SmartAppt Gold APK Builder
echo ============================================================
echo.

:: .env.mobile is gitignored, so a fresh clone will not have one. Rather than
:: fail, write the Gold default — an absent file is not a decision anyone made.
if not exist "frontend\.env.mobile" (
    echo   frontend\.env.mobile not found. Creating it, pointing at Gold.
    echo VITE_API_URL=https://!EXPECTED_HOST!/api/v1>"frontend\.env.mobile"
    echo.
)

echo   API for this build, from frontend\.env.mobile:
echo.
findstr /b "VITE_API_URL" frontend\.env.mobile
echo.

findstr /c:"%EXPECTED_HOST%" frontend\.env.mobile >nul
if errorlevel 1 (
    echo   ============================================================
    echo   ABORTED — wrong backend.
    echo   ============================================================
    echo.
    echo   Expected the Gold host:  %EXPECTED_HOST%
    echo.
    echo   Gold = smart-appt-app-development.up.railway.app
    echo   Lite = smart-appt-app-production.up.railway.app
    echo.
    echo   Gate staff, residents and all Gold data live on Gold. Building
    echo   against Lite produces an app that cannot log anyone in.
    echo.
    echo   Fix frontend\.env.mobile and run this again. If you genuinely
    echo   mean to build against a different backend, change EXPECTED_HOST
    echo   at the top of this script so the change is deliberate.
    echo.
    pause & exit /b 1
)
echo   [OK] Pointing at Gold.
echo.

:: ── Java ──────────────────────────────────────────────────────
:: Android Studio moves between drives depending on how it was installed,
:: so try the usual homes rather than hardcoding one.
set "JAVA_HOME="
for %%D in (
  "E:\Android Studio\jbr"
  "E:\Program Files\Android\Android Studio\jbr"
  "C:\Program Files\Android\Android Studio\jbr"
  "%LOCALAPPDATA%\Programs\Android Studio\jbr"
) do (
  if not defined JAVA_HOME if exist "%%~D\bin\java.exe" set "JAVA_HOME=%%~D"
)
if not defined JAVA_HOME (
    where java >nul 2>&1
    if errorlevel 1 (
        echo ERROR: No Java found. Install Android Studio or set JAVA_HOME.
        pause & exit /b 1
    )
) else (
    set "PATH=!JAVA_HOME!\bin;!PATH!"
)

if exist "C:\Program Files\nodejs\npm.cmd" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%APPDATA%\nvm\current\npm.cmd" (
    set "PATH=%APPDATA%\nvm\current;%PATH%"
)

java -version >nul 2>&1
if errorlevel 1 ( echo ERROR: Java not usable. JAVA_HOME=!JAVA_HOME! & pause & exit /b 1 )
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

:: ── Bake the API URL into the build ───────────────────────────
:: Vite reads .env.local, so .env.mobile is copied over it. This overwrites
:: whatever you were using for local dev.
echo.
echo [1/4] Using API URL from frontend\.env.mobile...
copy /Y frontend\.env.mobile frontend\.env.local >nul
echo [OK] .env.local written.

:: ── Build web app ─────────────────────────────────────────────
echo.
echo [2/4] Building frontend (production mode)...
cd frontend

:: Dependencies first. Without this, pulling a change that adds a package
:: fails here with a module-not-found error that reads like a code bug.
:: With the lockfile already satisfied this takes a couple of seconds.
call npm install --no-audit --no-fund
if errorlevel 1 ( echo   ERROR: npm install failed & pause & exit /b 1 )

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
findstr /b "VITE_API_URL" frontend\.env.mobile
echo ============================================================
echo.
echo  Install on phone:
echo    1. Settings ^> Install unknown apps ^> allow
echo    2. Transfer APK via USB / WhatsApp / email
echo    3. Tap to install
echo.
explorer /select,"%CD%\%APK_PATH%"
pause
