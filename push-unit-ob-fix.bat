@echo off
setlocal
cd /d "%~dp0"

git checkout feature/accounting-v2
git add backend/src/modules/accounting/unit-ob.service.ts
git commit -m "fix(accounting): fix ExcelJS Buffer type errors in unit-ob.service"
git push origin feature/accounting-v2

echo Done.
pause
endlocal
