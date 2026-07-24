@echo off
echo Removing Units/Flats tab from Manage Users page...
git add frontend/src/pages/admin/UserManagementPage.tsx
git commit -m "refactor: remove Units/Flats tab from UserManagementPage (handled by UnitManagementPage)"
git push origin main
echo Done.
pause
