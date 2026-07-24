@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/src/jobs/queue.ts
git add backend/src/modules/announcements/announcements.service.ts
git commit -m "fix: resilient Bull queues + logger import + normalise is_urgent boolean"
git push origin main
echo Done! Railway will redeploy in ~2 minutes.
pause
