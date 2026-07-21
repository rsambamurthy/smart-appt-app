@echo off
echo ============================================================
echo  Recreating SmartAppt Frontend Container
echo ============================================================
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

echo.
echo [1/3] Stopping frontend container...
docker-compose stop frontend

echo.
echo [2/3] Removing frontend container (clears old volumes/config)...
docker-compose rm -f frontend

echo.
echo [3/3] Rebuilding and starting fresh...
docker-compose up -d --build frontend

echo.
echo Waiting 20 seconds for Vite to start...
timeout /t 20 /nobreak >nul

echo.
echo ============================================================
echo  DONE! Now do this in Chrome:
echo  1. Press Ctrl+Shift+R (hard refresh)
echo  2. Enter phone: +919999999999
echo  3. Click Send OTP
echo  4. Enter OTP: 000000
echo  5. Click Verify and Login
echo ============================================================
pause
