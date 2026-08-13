@echo off
setlocal enabledelayedexpansion
echo ============================================================
echo  SmartAppt Gold — Gradle offline setup + APK build
echo ============================================================
echo.

set "MOBILE=%~dp0mobile-gold"
set "ANDROID=%MOBILE%\android"
set "WRAPPER_PROPS=%ANDROID%\gradle\wrapper\gradle-wrapper.properties"

:: ── Read the Gradle version from gradle-wrapper.properties ────────────────────
set "_GRADLE_VER="
for /f "tokens=2 delims=/" %%A in ('findstr "distributionUrl" "%WRAPPER_PROPS%"') do (
  :: line looks like: distributionUrl=https\://services.gradle.org/distributions/gradle-8.8-all.zip
  :: Split by / — %%A will be the filename part
  set "_GRADLE_ZIP=%%A"
)
:: Extract just the zip filename from the full URL line
for /f "tokens=* delims= " %%L in ('findstr "distributionUrl" "%WRAPPER_PROPS%"') do set "_DISTLINE=%%L"
for %%F in ("%_DISTLINE:~0,-4%") do set "_GRADLE_ZIP_NAME=%%~nxF"
set "_GRADLE_ZIP_NAME=%_GRADLE_ZIP_NAME%.zip"

:: Parse version from zip name (gradle-8.8-all.zip → gradle-8.8-all)
for %%F in ("%_GRADLE_ZIP_NAME%") do set "_GRADLE_DIST=%%~nF"

echo   Gradle distribution needed: %_GRADLE_DIST%
echo.

:: ── Find the hash directory Gradle created when it tried to download ──────────
set "_DISTS=%USERPROFILE%\.gradle\wrapper\dists"
set "_HASH_DIR="
if exist "%_DISTS%\%_GRADLE_DIST%\" (
  for /d %%H in ("%_DISTS%\%_GRADLE_DIST%\*") do set "_HASH_DIR=%%H"
)

if not defined _HASH_DIR (
  :: Gradle hasn't even created the hash dir yet — create it by running once (it will fail to download, that's OK)
  echo   Initializing Gradle cache directory...
  cd /d "%ANDROID%"
  call gradlew.bat --version >nul 2>&1
  cd /d "%~dp0"
  for /d %%H in ("%_DISTS%\%_GRADLE_DIST%\*") do set "_HASH_DIR=%%H"
)

echo ============================================================
echo  ACTION REQUIRED — 2 minutes
echo ============================================================
echo.
echo  1. Open this URL in your browser and download the zip:
echo.
echo     https://services.gradle.org/distributions/%_GRADLE_DIST%.zip
echo.
if defined _HASH_DIR (
  echo  2. Save the downloaded file to EXACTLY this folder:
  echo.
  echo     !_HASH_DIR!
  echo.
  echo     The file must be named: %_GRADLE_DIST%.zip
) else (
  echo  2. Save the downloaded file to:
  echo.
  echo     %_DISTS%\%_GRADLE_DIST%\^<any-subfolder^>\%_GRADLE_DIST%.zip
  echo     ^(create the subfolder if needed^)
)
echo.
echo  3. Press ENTER here once the file is downloaded.
echo.
pause

:: ── Find JAVA_HOME ────────────────────────────────────────────────────────────
set "JAVA_HOME="
for %%D in (
  "E:\Program Files\Android\Android Studio\jbr"
  "E:\Program Files\Android\Android Studio\jre"
  "E:\Android Studio\jbr"
  "E:\Android Studio\jre"
  "E:\Android\Android Studio\jbr"
  "E:\Android\Android Studio\jre"
  "C:\Program Files\Android\Android Studio\jbr"
  "C:\Program Files\Android\Android Studio\jre"
  "%LOCALAPPDATA%\Programs\Android Studio\jbr"
) do (
  if exist "%%~D\bin\java.exe" (
    if not defined JAVA_HOME set "JAVA_HOME=%%~D"
  )
)
if not defined JAVA_HOME (
  for /f "delims=" %%J in ('where /r "E:\" java.exe 2^>nul') do (
    if not defined JAVA_HOME (
      for %%K in ("%%~dpJ..") do (
        if exist "%%~fK\bin\java.exe" set "JAVA_HOME=%%~fK"
      )
    )
  )
)
if defined JAVA_HOME (
  echo   Using JDK: %JAVA_HOME%
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)

:: ── Find the Android SDK and write local.properties ───────────────────────────
set "SDK_DIR="
for %%D in (
  "%LOCALAPPDATA%\Android\Sdk"
  "E:\Android\Sdk"
  "E:\AndroidSdk"
  "E:\Sdk"
  "E:\Android\sdk"
  "E:\Program Files\Android\Sdk"
  "C:\Android\Sdk"
  "%USERPROFILE%\AppData\Local\Android\Sdk"
) do (
  if exist "%%~D\platform-tools" (
    if not defined SDK_DIR set "SDK_DIR=%%~D"
  )
)

:: Fallback: scan E: for platform-tools\adb.exe
if not defined SDK_DIR (
  echo   Scanning E: for the Android SDK...
  for /f "delims=" %%A in ('where /r "E:\" adb.exe 2^>nul') do (
    if not defined SDK_DIR (
      for %%K in ("%%~dpA..") do set "SDK_DIR=%%~fK"
    )
  )
)

if not defined SDK_DIR (
  echo.
  echo   ERROR: Android SDK not found.
  echo   Open Android Studio - Settings - Languages ^& Frameworks - Android SDK
  echo   and note the "Android SDK Location" path. Then create the file:
  echo     %ANDROID%\local.properties
  echo   with a single line like:  sdk.dir=E:/Android/Sdk
  echo   ^(use forward slashes^) and re-run this bat.
  echo.
  pause & exit /b 1
)

echo   Using Android SDK: %SDK_DIR%
:: local.properties needs forward slashes or escaped backslashes
set "SDK_DIR_FWD=%SDK_DIR:\=/%"
echo sdk.dir=%SDK_DIR_FWD%> "%ANDROID%\local.properties"
echo   Wrote local.properties

:: ── Build ─────────────────────────────────────────────────────────────────────
echo.
cd /d "%ANDROID%"

:: Force the JS bundle to regenerate (entry point changed)
if exist "%ANDROID%\app\build\generated" rmdir /s /q "%ANDROID%\app\build\generated"

echo   Building APK - offline, lint disabled...
call gradlew.bat assembleRelease --no-daemon --offline
if not errorlevel 1 goto :build_ok

echo.
echo   Offline build failed - retrying online...
call gradlew.bat assembleRelease --no-daemon
if not errorlevel 1 goto :build_ok

echo.
echo   Build failed. Check the output above.
cd /d "%~dp0"
pause
exit /b 1

:build_ok
cd /d "%~dp0"

:: ── Copy APK out ──────────────────────────────────────────────────────────────
set "SRC=%ANDROID%\app\build\outputs\apk\release\app-release.apk"
set "DEST=%~dp0SmartApptGold-fixed.apk"
copy /y "%SRC%" "%DEST%" >nul
echo.
echo ============================================================
echo  APK ready: SmartApptGold-fixed.apk
echo ============================================================
echo.
pause
