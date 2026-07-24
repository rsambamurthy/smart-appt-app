@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git commit --allow-empty -m "chore: trigger Railway redeploy"
git push origin main

echo Done! Railway will pick this up and deploy all queued commits.
pause
