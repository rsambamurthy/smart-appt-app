@echo off
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

git add frontend/src/pages/dues/DuesConfigPage.tsx

git commit -m "feat: redesign DuesConfigPage — stacked icon-card layout (option 1)"

git push origin main

echo.
echo Done! DuesConfigPage redesign pushed.
pause
