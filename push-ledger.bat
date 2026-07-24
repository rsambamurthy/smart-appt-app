@echo off
echo === Ledger View — push to git ===

git add backend/src/modules/accounting/journal.service.ts
git add backend/src/modules/accounting/journal.controller.ts
git add backend/src/modules/accounting/accounting.routes.ts
git add frontend/src/store/api/accountingApi.ts
git add frontend/src/pages/accounting/LedgerPage.tsx
git add frontend/src/App.tsx
git add frontend/src/components/organisms/Layout.tsx

git commit -m "feat: Ledger view — per-account statement with running balance"
git push

echo.
echo === Done. No SQL needed — Ledger uses existing journal_entries + journal_lines tables. ===
pause
