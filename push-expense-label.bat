@echo off
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

git add frontend/src/pages/expenses/ExpenseListPage.tsx
git add frontend/src/components/organisms/Layout.tsx

git commit -m "fix: rename breadcrumb label from Expense List to Expense"

git push origin main

echo Done!
pause
