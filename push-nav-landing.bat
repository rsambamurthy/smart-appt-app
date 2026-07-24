@echo off
echo Staging nav landing page changes...

git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx

git commit -m "feat: dues and transactions group headers navigate to landing pages"
git push origin main

echo Done. Check Railway for deployment.
pause
