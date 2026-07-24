@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/src/services/whatsapp.service.ts
git commit -m "fix: use WhatsApp template for OTP, bump API to v21, log full Meta response"
git push origin main
echo Done!
pause
