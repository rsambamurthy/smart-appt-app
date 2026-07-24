@echo off
echo Staging transactions dashboard changes...

git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/expenses/expenses.service.ts
git add frontend/src/store/api/expensesApi.ts
git add frontend/src/pages/transactions/TransactionsDashboardPage.tsx

git commit -m "feat: transactions dashboard - this month / overall tabs"
git push origin main

echo Done. Check Railway for deployment.
pause
