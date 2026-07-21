@echo off
echo ============================================================
echo  Starting SmartAppt Frontend (first-time build)
echo ============================================================
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

echo.
echo [1/2] Building and starting frontend container...
docker-compose up -d --build frontend

echo.
echo [2/2] Done! Waiting for Vite to start...
timeout /t 10 /nobreak >nul

echo.
echo ============================================================
echo  Frontend should be available at: http://localhost:5173
echo  Login with phone: +919999999999
echo  (check Docker Desktop logs for the OTP)
echo ============================================================
pause
