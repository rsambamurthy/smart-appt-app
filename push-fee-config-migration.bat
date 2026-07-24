@echo off
echo Pushing fee_configs migration + auto-migrate on deploy...
git add backend/prisma/migrations/20260723000001_add_fee_configs/migration.sql
git add backend/railway.toml
git add backend/src/modules/dues/fee-config.service.ts
git add backend/src/modules/dues/fee-config.controller.ts
git add backend/src/modules/dues/fee-config.routes.ts
git add backend/src/modules/dues/dues.routes.ts
git add backend/prisma/schema.prisma
git add frontend/src/pages/dues/DuesConfigPage.tsx
git add frontend/src/store/api/duesApi.ts
git commit -m "feat: add fee_configs table migration + auto-migrate on Railway deploy"
git push origin main
echo Done.
pause
