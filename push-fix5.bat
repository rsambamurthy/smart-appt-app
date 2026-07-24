@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/scripts/create-super-user.js
git commit -m "add: create-super-user script for Railway console"
git push origin main
echo Done!
pause
