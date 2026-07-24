@echo off
echo Staging Razorpay configuration changes...

git add backend/prisma/schema.prisma
git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/dues/dues.controller.ts
git add backend/src/modules/dues/dues.routes.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/pages/config/RazorpayConfigPage.tsx
git add frontend/src/components/organisms/Layout.tsx
git add frontend/src/pages/admin/MenuConfigPage.tsx
git add frontend/src/App.tsx

git commit -m "feat: per-association Razorpay config — Treasurer enters own keys, payments route to association bank"
git push origin main

echo Done. Run migration on Railway: npx prisma db push
pause
