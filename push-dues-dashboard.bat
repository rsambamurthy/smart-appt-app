@echo off
echo Staging dues dashboard changes...

git add backend/src/modules/dues/dues.service.ts
git add frontend/src/pages/dues/DuesDashboardPage.tsx

git commit -m "feat: dues overview - this month / overall tabs with billed, collected, arrears"
git push origin main

echo Done. Check Railway for deployment.
pause
