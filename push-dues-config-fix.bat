@echo off
echo Pushing DuesConfig decimal fix...

git add backend/src/modules/dues/dues.service.ts

git commit -m "fix: serialize Prisma Decimal fields to numbers in getConfig response"
git push origin main

echo Done.
pause
