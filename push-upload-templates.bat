@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app
echo Pushing bulk upload templates (User + Unit)...
git add frontend/public/templates/SmartAppt_UserUpload_Template.xlsx
git add frontend/public/templates/SmartAppt_UnitUpload_Template.xlsx
git add frontend/src/pages/admin/UserManagementPage.tsx
git add frontend/src/pages/admin/UnitManagementPage.tsx
git commit -m "feat: replace generated templates with rich xlsx files (dropdowns, validation, instructions)"
git push origin main
echo Done! Vercel will redeploy automatically.
pause
