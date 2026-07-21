@echo off
echo ============================================================
echo  Rebuilding smartappt-api (backend) with OpenSSL fix
echo ============================================================
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

echo.
echo [1/5] Stopping backend container...
docker-compose stop backend

echo.
echo [2/5] Removing backend container AND its anonymous volumes...
docker-compose rm -f -v backend

echo.
echo [3/5] Removing dangling volumes (stale node_modules)...
docker volume prune -f

echo.
echo [4/5] Rebuilding backend image with --no-cache...
docker-compose build --no-cache backend

echo.
echo [5/5] Starting backend container...
docker-compose up -d backend

echo.
echo ============================================================
echo  Done! Backend rebuilt with OpenSSL support.
echo  Wait ~15 seconds for it to be healthy, then run setup-db.bat
echo ============================================================
pause
