@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

echo Clearing git locks...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\COMMIT_EDITMSG.lock" 2>nul
del /f /q ".git\config.lock" 2>nul

git add backend/src/app.ts
git add backend/src/modules/announcements/announcements.service.ts
git add backend/src/modules/announcements/announcements.routes.ts
git add frontend/src/store/api/announcementsApi.ts
git add frontend/src/pages/announcements/AnnouncementFeedPage.tsx

echo.
git status
echo.

git commit -m "feat: announcement hard-delete with real-time socket broadcast"

git push origin main

echo.
echo Done! Railway + Vercel will redeploy in ~2 minutes.
pause
