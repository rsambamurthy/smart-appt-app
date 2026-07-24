@echo off
echo Pushing fee config error and date format fixes...
git add frontend/src/pages/dues/DuesConfigPage.tsx
git add backend/src/modules/dues/fee-config.service.ts
git commit -m "fix: clear stale error on data load, normalize as_on_date to YYYY-MM-DD"
git push origin main
echo Done.
pause
