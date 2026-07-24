@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
del .git\index.lock 2>nul
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260722000001_add_mpin_hash/migration.sql
git add backend/src/modules/auth/auth.service.ts
git add backend/src/modules/auth/auth.controller.ts
git add backend/src/modules/auth/auth.routes.ts
git add backend/src/modules/auth/auth.schema.ts
git add frontend/src/store/api/authApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/pages/LoginPage.tsx
git add frontend/src/pages/ChangeMpinPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx
git commit -m "feat: 4-digit M-PIN login (set, verify, reset, change)"
git push origin main
echo.
echo Done!
echo.
echo NEXT STEP - Run in Railway Console:
echo   npx prisma migrate deploy
echo.
pause
