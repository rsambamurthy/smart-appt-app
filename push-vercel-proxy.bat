@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add frontend/vercel.json
git commit -m "fix: proxy /api/v1/* to Railway backend via vercel.json rewrite"
git push origin main
echo Done! Vercel will auto-redeploy in ~1 minute.
pause
