@echo off
setlocal
title SmartAppt Railway Setup

echo ============================================================
echo   SmartAppt - New Railway Project Setup
echo   Branch: feature/accounting-v2
echo ============================================================
echo.

:: ── Locate Node ────────────────────────────────────────────────
if exist "C:\Program Files\nodejs\npm.cmd" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "%APPDATA%\nvm\current\npm.cmd"   set "PATH=%APPDATA%\nvm\current;%PATH%"

node --version >nul 2>&1
if errorlevel 1 ( echo ERROR: Node.js not found & pause & exit /b 1 )

:: ── Install Railway CLI if missing ─────────────────────────────
where railway >nul 2>&1
if errorlevel 1 (
    echo Installing Railway CLI globally...
    call npm install -g @railway/cli
    if errorlevel 1 ( echo ERROR: Could not install Railway CLI & pause & exit /b 1 )
)
railway --version
echo [OK] Railway CLI ready.

:: ── Step 1: Login ──────────────────────────────────────────────
echo.
echo [STEP 1/4] Login to Railway (browser will open)...
railway login
if errorlevel 1 ( echo ERROR: Login failed & pause & exit /b 1 )
echo [OK] Logged in.

:: ── Step 2: Create project ─────────────────────────────────────
echo.
echo [STEP 2/4] Creating new Railway project...
echo   When prompted for a project name, type: SmartAppt
echo.
railway init
if errorlevel 1 ( echo ERROR: Project creation failed & pause & exit /b 1 )
echo [OK] Project created.

:: ── Step 3: Add PostgreSQL ─────────────────────────────────────
echo.
echo [STEP 3/4] Adding PostgreSQL database service...
railway add --plugin postgresql
if errorlevel 1 (
    echo.
    echo WARNING: Could not add PostgreSQL via CLI.
    echo   Add it manually: Railway dashboard -^> SmartAppt project
    echo   -^> "+ New" -^> Database -^> PostgreSQL
    echo.
    pause
)

:: ── Step 4: Deploy backend ─────────────────────────────────────
echo.
echo [STEP 4/4] Deploying backend from backend/ directory...
cd /d "%~dp0backend"
railway up --detach
if errorlevel 1 (
    echo.
    echo NOTE: Deploy may fail on first run if env vars are not set.
    echo   Set variables first (see instructions below),
    echo   then re-run from backend/ directory: railway up --detach
    echo.
)

echo.
echo ================================================================
echo   MANDATORY NEXT STEPS  (Railway dashboard + Vercel)
echo ================================================================
echo.
echo   1. Open railway.app -^> SmartAppt project -^> backend service
echo      -^> Variables tab. Add ALL of these:
echo.
echo       JWT_SECRET          ^<copy from appealing-integrity project^>
echo       NODE_ENV            production
echo       PORT                3000
echo       RAZORPAY_KEY_ID     ^<copy from appealing-integrity project^>
echo       RAZORPAY_KEY_SECRET ^<copy from appealing-integrity project^>
echo.
echo      DATABASE_URL is injected automatically by Railway PostgreSQL.
echo.
echo   2. Trigger / re-trigger deploy after setting vars:
echo      Railway dashboard -^> backend service -^> Deployments -^> Redeploy
echo.
echo   3. Get the new backend public URL:
echo      Railway -^> backend service -^> Settings -^> Networking
echo      Click "Generate Domain". Example:
echo        https://smartappt-backend-production.up.railway.app
echo.
echo   4. Run migrations on the new PostgreSQL:
echo      Railway -^> PostgreSQL service -^> Data tab -^> Query
echo      Paste and run the full contents of railway-apply-fy-migrations.sql
echo.
echo   5. Update Vercel env var VITE_API_URL:
echo      Vercel -^> Project Settings -^> Environment Variables
echo        VITE_API_URL = https://YOUR-NEW-DOMAIN.railway.app/api/v1
echo      Then: Deployments -^> Redeploy latest
echo ================================================================
pause
endlocal
