@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git add frontend/src/pages/dues/OneTimeDuesPage.tsx

git commit -m "fix: one-time dues unit list shows flat + occupant, radio buttons on same line"

git push origin main

echo Done!
pause
