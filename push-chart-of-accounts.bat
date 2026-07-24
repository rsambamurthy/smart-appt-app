@echo off
echo === Chart of Accounts — push to git ===

git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260723000003_chart_of_accounts/migration.sql
git add backend/src/modules/accounting/accounting.schema.ts
git add backend/src/modules/accounting/accounting.service.ts
git add backend/src/modules/accounting/accounting.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add backend/src/app.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/pages/accounting/ChartOfAccountsPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx

git commit -m "feat: Chart of Accounts — model, backend CRUD, seed, frontend page + nav"
git push

echo.
echo === Done. Railway will now build. ===
echo.
echo === Run this SQL on Railway BEFORE the build completes: ===
echo.
echo CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');
echo.
echo CREATE TABLE "accounts" (
echo   "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
echo   "association_id" UUID         NOT NULL,
echo   "code"           VARCHAR(20)  NOT NULL,
echo   "name"           VARCHAR(120) NOT NULL,
echo   "type"           "AccountType" NOT NULL,
echo   "sub_type"       VARCHAR(60),
echo   "description"    VARCHAR(255),
echo   "is_system"      BOOLEAN      NOT NULL DEFAULT false,
echo   "is_active"      BOOLEAN      NOT NULL DEFAULT true,
echo   "sort_order"     SMALLINT     NOT NULL DEFAULT 0,
echo   "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
echo   "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
echo   CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
echo   CONSTRAINT "accounts_association_id_code_key" UNIQUE ("association_id", "code"),
echo   CONSTRAINT "accounts_association_id_fkey" FOREIGN KEY ("association_id")
echo     REFERENCES "associations"("id") ON DELETE CASCADE
echo );
echo.
pause
