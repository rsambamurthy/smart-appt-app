@echo off
echo Pushing manager ticket access fix...
cd /d "%~dp0"

git add frontend/src/pages/maintenance/TicketListPage.tsx
git add frontend/src/pages/mobile/MobileHomePage.tsx

git commit -m "feat: manager sees all tickets on mobile with status filter and action; others see own tickets"

git push origin main
echo.
echo Done! Rebuild APK after Railway redeploys.
pause
