@echo off
echo Rebuilding smartappt-worker — removing old volumes to force fresh node_modules...
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

REM Stop and remove the worker container AND its anonymous volumes
docker-compose stop worker
docker-compose rm -f -v worker

REM Remove any orphaned anonymous volumes from old worker containers
FOR /F "tokens=*" %%i IN ('docker volume ls -q --filter dangling^=true') DO (
    docker volume rm %%i 2>nul
)

REM Rebuild image with updated prisma schema (binaryTargets)
docker-compose build --no-cache worker

REM Start fresh (new anonymous volume will be created from rebuilt image)
docker-compose up -d worker

echo Done!
pause
