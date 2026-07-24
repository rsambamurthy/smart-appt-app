@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
git add backend/src/index.ts
git commit -m "fix: dont exit on DB/Redis connect failure, keep server alive for healthcheck"
git push origin main
echo Done! Railway will now redeploy.
pause
