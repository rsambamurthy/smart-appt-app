@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git add backend/src/modules/dues/dues.service.ts

git commit -m "fix: convert cash_balance_as_on string to Date before Prisma upsert"

git push origin main

echo Done! Railway will redeploy in ~2 minutes.
pause
