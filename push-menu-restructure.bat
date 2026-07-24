@echo off
echo Staging menu restructure + transactions dashboard...

git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx
git add frontend/src/pages/transactions/TransactionsDashboardPage.tsx
git add frontend/src/pages/transactions/ReportsPage.tsx
git add frontend/src/store/api/expensesApi.ts
git add frontend/src/App.tsx

git add backend/src/modules/expenses/expenses.service.ts
git add backend/src/modules/expenses/expenses.controller.ts
git add backend/src/modules/expenses/expenses.routes.ts

git commit -m "feat: menu restructure, transactions dashboard, reports placeholder"
git push origin main

echo Done. Check Railway for deployment.
pause
