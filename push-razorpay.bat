@echo off
cd /d C:\Users\LALITHA\Claude\Projects\SmartAppT\smart-appt-app

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git add backend/src/modules/dues/dues.service.ts
git add backend/src/modules/dues/dues.controller.ts
git add backend/src/modules/dues/dues.routes.ts
git add frontend/src/store/api/duesApi.ts
git add frontend/src/hooks/useRazorpay.ts
git add frontend/src/pages/dues/MyBillsPage.tsx

git status

git commit -m "feat: Razorpay online payment - verifyPayment + checkout hook + MyBillsPage"

git push origin main

echo.
echo Done! Waiting for Railway + Vercel to redeploy.
echo.
echo IMPORTANT - Add these env vars in Railway dashboard:
echo   RAZORPAY_KEY_ID=rzp_test_xxxx
echo   RAZORPAY_KEY_SECRET=xxxx
echo   RAZORPAY_WEBHOOK_SECRET=xxxx
echo.
echo And in Vercel dashboard:
echo   VITE_RAZORPAY_KEY_ID=rzp_test_xxxx
echo.
pause
