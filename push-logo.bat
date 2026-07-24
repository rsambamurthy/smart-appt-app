@echo off
echo Staging logo changes...

git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/LoginPage.tsx
git add frontend/public/smartappt-logo.png

git commit -m "feat: use SmartAppt logo in header and login page"
git push origin main

echo Done. Check Vercel for deployment.
pause
