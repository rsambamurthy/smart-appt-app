@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add frontend/src/pages/LoginPage.tsx
git add frontend/src/pages/ChangeMpinPage.tsx
git commit -m "fix: move PinInput outside component to prevent focus loss on re-render"
git push origin main
echo Done! Vercel will redeploy in ~1 minute.
pause
