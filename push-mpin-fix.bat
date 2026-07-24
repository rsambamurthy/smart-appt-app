@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add frontend/src/pages/LoginPage.tsx
git add frontend/src/pages/ChangeMpinPage.tsx
git commit -m "fix: remove duplicate autoFocus on PIN inputs causing focus jump"
git push origin main
echo Done! Vercel will redeploy in ~1 minute.
pause
