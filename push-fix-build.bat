@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git add backend/src/modules/dues/dues.controller.ts
git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/dues/dues.routes.ts
git add backend/src/modules/expenses/expenses.service.ts
git add backend/src/modules/expenses/expenses.routes.ts
git add frontend/src/pages/dues/DuesBillsPage.tsx
git add frontend/src/pages/expenses/TransparencyPage.tsx
git add frontend/src/pages/expenses/ExpenseListPage.tsx

git commit -m "fix: push dues controller with verifyPayment + all ui changes"

git push origin main

echo Done!
pause
