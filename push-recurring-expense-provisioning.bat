@echo off
echo Staging recurring expense provisioning changes...

git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260820000001_recurring_expense_provisioning
git add backend/prisma/migrations/20260820000002_vendor_accounts_payable_link
git add backend/src/jobs/worker-entry.ts
git add backend/src/jobs/workers/notification-dispatcher.ts
git add backend/src/jobs/workers/expense-provisioner.ts
git add backend/src/modules/accounting/accounting.service.ts
git add backend/src/modules/accounting/bp-type.seed.ts
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/expenses/expenses.controller.ts
git add backend/src/modules/expenses/expenses.routes.ts
git add backend/src/modules/expenses/expenses.schema.ts
git add backend/src/modules/expenses/expenses.service.ts
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/store/api/expensesApi.ts
git add frontend/src/pages/expenses/RecurringExpensesPage.tsx

git commit -m "feat(accounting): month-end accrual for recurring expenses via Accounts Payable"
git push origin feature/accounting-v2

echo.
echo ============================================================
echo IMPORTANT: After deployment, run on Railway (smart-appt-app, Development env):
echo   npx prisma migrate deploy
echo.
echo This picks up the two new migrations:
echo   20260820000001_recurring_expense_provisioning
echo   20260820000002_vendor_accounts_payable_link
echo ============================================================
echo.
echo Done. Check Railway for the smart-appt-app Development deployment.
pause
