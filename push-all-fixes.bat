@echo off
echo Staging all pending fixes...

git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/dues/dues.controller.ts
git add backend/src/modules/dues/dues.routes.ts
git add backend/src/modules/dues/dues.schema.ts
git add backend/src/modules/receipts/receipts.schema.ts
git add backend/src/modules/receipts/receipts.service.ts
git add backend/src/modules/receipts/receipts.controller.ts
git add backend/src/modules/receipts/receipts.routes.ts
git add backend/src/modules/users/users.routes.ts
git add backend/src/app.ts
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/

git add frontend/src/store/api/baseApi.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/store/api/receiptsApi.ts
git add frontend/src/pages/dues/OneTimeDuesPage.tsx
git add frontend/src/pages/receipts/OtherReceiptsPage.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/App.tsx

git commit -m "feat: other receipts module, one-time due unit targeting, delete bills, hard deletes, UI fixes"
git push origin main

echo Done. Check Railway for deployment.
pause
