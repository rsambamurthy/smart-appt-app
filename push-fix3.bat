@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/src/modules/auth/auth.routes.ts
git commit -m "fix: make Google OAuth conditional on env vars — prevents crash when not configured"
git push origin main
echo Done!
pause
