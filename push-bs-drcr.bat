@echo off
echo ============================================================
echo  Pushing: Balance Sheet Dr/Cr tags
echo ============================================================
echo.
echo  NO SQL required.
echo.
cd /d "%~dp0"
git add frontend/src/pages/accounting/BalanceSheetPage.tsx
git commit -m "feat: show Dr/Cr tag on each amount in Balance Sheet"
git push
echo.
echo Done!
pause
