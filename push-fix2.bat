@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/src/config/redis.ts backend/src/index.ts backend/src/app.ts backend/Dockerfile
git commit -m "fix: lazyConnect redis, health first, unhandledRejection guard, local prisma binary"
git push origin main
echo Done! Railway will redeploy.
pause
