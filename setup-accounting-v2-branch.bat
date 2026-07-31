@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
echo Creating feature/accounting-v2 branch...
git checkout -b feature/accounting-v2
git push -u origin feature/accounting-v2
echo.
echo Branch created and pushed to GitHub.
echo Next: Set up Railway Dev environment and point Vercel preview to it.
pause
