@echo off
echo ============================================================
echo  Full rebuild: backend + worker (OpenSSL fix)
echo ============================================================
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

echo.
echo [1/6] Stopping backend and worker...
docker-compose stop backend worker

echo.
echo [2/6] Removing containers AND anonymous volumes...
docker-compose rm -f -v backend worker

echo.
echo [3/6] Removing dangling volumes (stale node_modules)...
docker volume prune -f

echo.
echo [4/6] Rebuilding backend image with --no-cache...
docker-compose build --no-cache backend

echo.
echo [5/6] Rebuilding worker image with --no-cache...
docker-compose build --no-cache worker

echo.
echo [6/6] Starting all services...
docker-compose up -d

echo.
echo ============================================================
echo  Done! All services rebuilt with OpenSSL support.
echo  Wait ~20 seconds, then run setup-db.bat
echo ============================================================
pause
