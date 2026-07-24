@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add frontend/src/pages/announcements/AnnouncementFeedPage.tsx
git commit -m "feat: full announcement feed — UI, compose, polls, detail expand"
git push origin main
echo Done! Vercel will redeploy in ~1 minute.
pause
