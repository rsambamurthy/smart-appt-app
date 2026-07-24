@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

REM ── Backend ──────────────────────────────────────────────────────────────────
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20250722_other_receipts_and_unit_targeting/migration.sql
git add backend/src/app.ts
git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/dues/dues.schema.ts
git add backend/src/modules/dues/dues.routes.ts
git add backend/src/modules/dues/dues.controller.ts
git add backend/src/modules/receipts/receipts.schema.ts
git add backend/src/modules/receipts/receipts.service.ts
git add backend/src/modules/receipts/receipts.controller.ts
git add backend/src/modules/receipts/receipts.routes.ts
git add backend/src/modules/expenses/expenses.service.ts
git add backend/src/modules/expenses/expenses.routes.ts

REM ── Frontend ─────────────────────────────────────────────────────────────────
git add frontend/src/store/api/baseApi.ts
git add frontend/src/store/api/receiptsApi.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/pages/receipts/OtherReceiptsPage.tsx
git add frontend/src/pages/dues/OneTimeDuesPage.tsx
git add frontend/src/pages/dues/DuesBillsPage.tsx
git add frontend/src/pages/expenses/ExpenseListPage.tsx
git add frontend/src/pages/expenses/TransparencyPage.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/App.tsx

git commit -m "feat: other receipts module + one-time dues unit targeting + ui changes"

git push origin main

echo.
echo Done! Railway will rebuild in ~2 minutes.
echo IMPORTANT: Run the Prisma migration on Railway after the deploy succeeds.
pause
