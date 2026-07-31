@echo off
setlocal
cd /d "%~dp0"

echo === SmartAppt: Journal entries — BV/CV auto-detection + split-panel + voucher form (feature/accounting-v2) ===
echo.

git checkout feature/accounting-v2
if errorlevel 1 ( echo ERROR: Could not switch to feature/accounting-v2 & pause & exit /b 1 )

echo --- Stage files ---
git add backend/src/modules/accounting/journal.schema.ts
git add backend/src/modules/accounting/journal.service.ts
git add backend/src/middleware/errorHandler.ts
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260725000001_add_bv_voucher_type/migration.sql
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/JournalEntriesPage.tsx

git status
echo.
echo Files staged. Press any key to commit and push, or Ctrl+C to abort.
pause > nul

git commit -m "feat(accounting): BV/CV auto-detection + split-panel voucher form for journal entries"
if errorlevel 1 ( echo ERROR: commit failed & pause & exit /b 1 )

git push origin feature/accounting-v2
if errorlevel 1 ( echo ERROR: push failed & pause & exit /b 1 )

echo.
echo === Done. Railway will rebuild automatically. ===
pause
endlocal
