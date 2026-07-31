@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
git checkout feature/accounting-v2
echo Pushing accounting v2 schema changes...
git add backend/prisma/schema.prisma
git commit -m "feat(accounting-v2): new schema — BPType, BusinessPartner, VoucherSequence, updated Account/JournalEntry/JournalLine"
git push origin feature/accounting-v2
echo Done. Railway dev will auto-deploy.
pause
