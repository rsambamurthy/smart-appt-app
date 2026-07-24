@echo off
echo Pushing bulk import feature for Users and Units...
git add backend/src/modules/users/users.service.ts
git add backend/src/modules/users/users.controller.ts
git add backend/src/modules/users/users.routes.ts
git add frontend/package.json
git add frontend/src/store/api/usersApi.ts
git add frontend/src/pages/admin/UserManagementPage.tsx
git commit -m "feat: bulk import Units and Users from Excel/CSV with validation preview"
git push origin main
echo Done.
pause
