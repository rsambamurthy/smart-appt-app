@echo off
echo ============================================================
echo  Pushing: Manage Users fixes
echo  1. All users now shown (limit 500)
echo  2. Deleted unit no longer appears (soft delete)
echo ============================================================
echo.
echo  SQL TO RUN ON RAILWAY BEFORE DEPLOYING:
echo  ------------------------------------------
echo  ALTER TABLE units ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
echo  ------------------------------------------
echo.
cd /d "%~dp0"
git add frontend/src/pages/admin/UserManagementPage.tsx
git add frontend/src/pages/admin/UnitManagementPage.tsx
git add backend/src/modules/users/users.service.ts
git add backend/src/modules/users/users.schema.ts
git add backend/src/utils/helpers.ts
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260724000001_add_unit_deleted_at/migration.sql
git commit -m "fix: raise limit ceiling to 500 (was max 200 in schema, 100 in parsePagination); soft-delete units"
git push
echo.
echo Done!
pause
