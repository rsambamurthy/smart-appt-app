@echo off
echo Pushing bulk import to UnitManagementPage...
git add frontend/src/pages/admin/UnitManagementPage.tsx
git commit -m "feat: add bulk import (template + upload) to Manage Units page"
git push origin main
echo Done.
pause
