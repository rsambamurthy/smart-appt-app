@echo off
echo Restarting smartappt-worker with PRISMA_QUERY_ENGINE_LIBRARY fix...
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"
docker-compose stop worker
docker-compose rm -f worker
docker-compose up -d worker
echo Done! Check Docker Desktop logs for worker status.
pause
