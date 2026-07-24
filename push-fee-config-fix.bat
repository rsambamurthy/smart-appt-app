@echo off
echo Pushing AuthRequest import fix...
git add backend/src/modules/dues/fee-config.controller.ts
git commit -m "fix: correct AuthRequest import path in fee-config.controller.ts"
git push origin main
echo Done.
pause
