@echo off
echo Pushing Fee Configuration redesign...

git add backend/prisma/schema.prisma
git add backend/src/modules/dues/fee-config.service.ts
git add backend/src/modules/dues/fee-config.controller.ts
git add backend/src/modules/dues/fee-config.routes.ts
git add backend/src/modules/dues/dues.routes.ts
git add backend/src/modules/dues/dues.service.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/pages/dues/DuesConfigPage.tsx

git commit -m "feat: fee configuration redesign — horizontal table with active/inactive, FeeConfig model"
git push origin main

echo.
echo ============================================================
echo IMPORTANT: After deployment, run on Railway:
echo   npx prisma db push
echo.
echo Then seed FeeConfig from existing DuesConfig (run in Railway shell):
echo   node -e "
echo     const {PrismaClient} = require('@prisma/client');
echo     const p = new PrismaClient();
echo     p.duesConfig.findMany().then(async (configs) => {
echo       for (const c of configs) {
echo         const u = c.updated_by;
echo         await p.feeConfig.createMany({ data: [
echo           { association_id: c.association_id, fee_type: 'MONTHLY_CHARGE',
echo             calc_method: c.charge_type === 'RATE_PER_SQFT' ? 'RATE_PER_SQFT' : 'FIXED_AMOUNT',
echo             amount: c.charge_type === 'RATE_PER_SQFT' ? (c.rate_per_sqft || 0) : c.monthly_charge,
echo             due_day: c.due_day, is_active: true, updated_by: u },
echo           { association_id: c.association_id, fee_type: 'PENALTY_AMOUNT',
echo             calc_method: 'FIXED_AMOUNT', amount: c.penalty_value,
echo             due_day: c.due_day, is_active: true, updated_by: u },
echo           ...(c.cash_balance ? [{ association_id: c.association_id, fee_type: 'CASH_OPENING_BALANCE',
echo             amount: c.cash_balance, as_on_date: c.cash_balance_as_on,
echo             is_active: true, updated_by: u }] : [])
echo         ], skipDuplicates: true });
echo       }
echo       console.log('Done'); p.$disconnect();
echo     });
echo   "
echo ============================================================
pause
