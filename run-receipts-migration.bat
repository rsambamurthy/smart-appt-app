@echo off
echo Running migration for other_receipts + target_unit_ids...
echo.
echo This requires DATABASE_URL in your environment or .env file.
echo.
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app\backend

REM Use Prisma db push to apply schema changes (safe for Railway PostgreSQL)
npx prisma db push --accept-data-loss

echo.
echo Done! If you see errors, run the raw SQL in run-receipts-migration-raw.bat
pause
