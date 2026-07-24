@echo off
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260723000002_add_auto_generate_bills/migration.sql
git add backend/src/services/scheduler.service.ts
git add backend/src/index.ts
git add backend/src/modules/dues/dues.schema.ts
git add frontend/src/pages/dues/DuesConfigPage.tsx

git commit -m "feat: auto-generate bills - daily cron, per-association toggle and day config"

git push origin main

echo.
echo Done! Run this SQL on Railway DB:
echo.
echo ALTER TABLE dues_config ADD COLUMN IF NOT EXISTS auto_generate_bills BOOLEAN NOT NULL DEFAULT false;
echo ALTER TABLE dues_config ADD COLUMN IF NOT EXISTS auto_generate_day SMALLINT NOT NULL DEFAULT 1;
echo.
pause
