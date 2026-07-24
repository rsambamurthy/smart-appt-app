@echo off
echo Pushing maintenance route fix...
cd /d "%~dp0"

git add backend/src/modules/maintenance/maintenance.routes.ts

git commit -m "fix: open maintenance create/list-mine/feedback routes to all authenticated users (mobile no-role-difference)"

git push origin main
echo.
echo Done! Railway will redeploy. Then test raising and viewing service requests on mobile.
pause
