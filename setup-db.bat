@echo off
echo ============================================
echo  SmartAppt DB Setup
echo ============================================
cd /d "C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app"

echo.
echo [1/2] Running Prisma migration (creating all tables)...
docker-compose exec -T backend npx prisma migrate dev --name init
if %errorlevel% neq 0 (
  echo ERROR: Migration failed!
  pause
  exit /b 1
)

echo.
echo [2/2] Seeding database with test data...
docker-compose exec -T backend npm run prisma:seed
if %errorlevel% neq 0 (
  echo ERROR: Seed failed!
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Done! Database is ready.
echo  Manager login: +919999999999
echo  (OTP will be logged to console in dev mode)
echo ============================================
pause
