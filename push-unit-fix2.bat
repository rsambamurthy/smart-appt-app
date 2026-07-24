@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git add backend/src/modules/users/users.routes.ts
git add frontend/src/pages/dues/OneTimeDuesPage.tsx

git commit -m "fix: allow TREASURER to list units + fix radio label wrapping"

git push origin main

echo Done!
pause
