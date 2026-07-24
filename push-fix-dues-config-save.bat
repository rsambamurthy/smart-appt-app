@echo off
echo Fixing dues config save — convert Decimal fields in upsert response...
git add backend/src/modules/dues/dues.service.ts
git commit -m "fix: convert Prisma Decimal fields in upsertConfig response"
git push origin main
echo Done.
pause
