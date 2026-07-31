@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: BP Master push (feature/accounting-v2) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Step 1: Push schema to dev database ---
cd backend
if not exist .env (
  if exist ..\.env (
    copy ..\.env .env > nul
    echo Copied .env from project root.
  ) else (
    echo.
    echo ERROR: No .env file found in backend\ or project root.
    echo Create backend\.env with:
    echo   DATABASE_URL="postgresql://user:pass@host:5432/dbname"
    echo.
    pause & exit /b 1
  )
)
npx prisma@5 db push
if errorlevel 1 ( echo ERROR: prisma db push failed & pause & exit /b 1 )
cd ..

echo.
echo --- Step 2: Stage files ---
git add backend/prisma/schema.prisma
git add backend/src/modules/accounting/bp-master.service.ts
git add backend/src/modules/accounting/bp-master.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/pages/accounting/BusinessPartnersPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat(accounting): Business Partner Master — Banks, Vendors, Units with opening balance"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
pause
endlocal
