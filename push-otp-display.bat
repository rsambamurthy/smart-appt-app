@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/src/modules/auth/auth.service.ts
git commit -m "feat: always return dev_otp in response so login screen can display it"
git push origin main
echo Done! Railway will auto-deploy in ~2 minutes.
pause
