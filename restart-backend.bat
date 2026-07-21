@echo off
echo ============================================================
echo  Force-recreating backend container (reload latest code)
echo ============================================================
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

docker-compose up -d --force-recreate backend

echo.
echo Done! Backend is restarting with the latest code.
echo Wait ~10 seconds, then try registering an association again.
echo ============================================================
pause
