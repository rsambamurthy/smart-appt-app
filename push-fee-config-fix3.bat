@echo off
echo Pushing fee config fallback from DuesConfig...
git add backend/src/modules/dues/fee-config.service.ts
git add frontend/src/pages/dues/DuesConfigPage.tsx
git commit -m "fix: pre-fill FeeConfig page from legacy DuesConfig when FeeConfig is empty"
git push origin main
echo Done.
pause
