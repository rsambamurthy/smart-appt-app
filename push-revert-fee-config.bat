@echo off
echo Reverting fee_configs — restoring dues_config-based fee configuration...
git add backend/railway.toml
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260723000001_add_fee_configs/migration.sql
git add backend/src/modules/dues/fee-config.service.ts
git add backend/src/modules/dues/fee-config.controller.ts
git add backend/src/modules/dues/fee-config.routes.ts
git add backend/src/modules/dues/dues.routes.ts
git add backend/src/modules/dues/dues.service.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/pages/dues/DuesConfigPage.tsx
git commit -m "revert: remove fee_configs table, restore dues_config-based fee configuration"
git push origin main
echo Done.
pause
