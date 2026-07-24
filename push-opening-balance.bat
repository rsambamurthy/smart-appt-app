@echo off
echo Staging opening balance + nav landing changes...

git add backend/src/modules/dues/dues.service.ts
git add frontend/src/pages/transactions/TransactionsDashboardPage.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx

git commit -m "feat: dynamic opening balance for this month + nav landing pages for dues and transactions"
git push origin main

echo Done. Check Railway for deployment.
pause
