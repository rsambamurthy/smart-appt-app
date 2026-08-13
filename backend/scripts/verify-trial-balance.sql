-- ============================================================================
--  Verify the Trial Balance against the Balance Sheet and P&L.  READ-ONLY.
--
--  All three read the same source — POSTED journal lines — so they must agree.
--  Run this and compare with what the app shows for the same date.
-- ============================================================================


-- ── 1. Trial Balance totals: debits must equal credits ──────────────────────
SELECT 'trial balance' AS report,
       SUM(jl.debit)  AS total_debit,
       SUM(jl.credit) AS total_credit,
       SUM(jl.debit) - SUM(jl.credit) AS difference   -- must be 0.00
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
JOIN   accounts a         ON a.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date <= '2026-08-02'::date
  AND  a.is_active AND NOT a.is_group;


-- ── 2. Net surplus, two ways — must match ───────────────────────────────────
-- (a) from the trial balance: credit balances of INCOME less debit of EXPENSE
-- (b) what the P&L reports for the same period
SELECT 'net surplus from TB' AS report,
       SUM(CASE WHEN a.type = 'INCOME'  THEN jl.credit - jl.debit ELSE 0 END)
     - SUM(CASE WHEN a.type = 'EXPENSE' THEN jl.debit - jl.credit ELSE 0 END) AS net_surplus
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
JOIN   accounts a         ON a.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date <= '2026-08-02'::date
  AND  a.is_active AND NOT a.is_group;


-- ── 3. Balance Sheet identity ───────────────────────────────────────────────
-- Assets must equal Liabilities + Equity + Net Surplus.
SELECT 'balance sheet' AS report,
       SUM(CASE WHEN a.type = 'ASSET'     THEN jl.debit - jl.credit ELSE 0 END) AS assets,
       SUM(CASE WHEN a.type = 'LIABILITY' THEN jl.credit - jl.debit ELSE 0 END) AS liabilities,
       SUM(CASE WHEN a.type = 'EQUITY'    THEN jl.credit - jl.debit ELSE 0 END) AS equity,
       SUM(CASE WHEN a.type = 'INCOME'    THEN jl.credit - jl.debit ELSE 0 END)
     - SUM(CASE WHEN a.type = 'EXPENSE'   THEN jl.debit  - jl.credit ELSE 0 END) AS net_surplus,
       SUM(CASE WHEN a.type = 'ASSET'     THEN jl.debit - jl.credit ELSE 0 END)
     - SUM(CASE WHEN a.type IN ('LIABILITY','EQUITY') THEN jl.credit - jl.debit ELSE 0 END)
     - (SUM(CASE WHEN a.type = 'INCOME'  THEN jl.credit - jl.debit ELSE 0 END)
      - SUM(CASE WHEN a.type = 'EXPENSE' THEN jl.debit  - jl.credit ELSE 0 END)) AS difference  -- must be 0.00
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
JOIN   accounts a         ON a.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date <= '2026-08-02'::date
  AND  a.is_active AND NOT a.is_group;


-- ── 4. Cash Book closing balance = Trial Balance figure for 1001 ────────────
SELECT 'cash 1001' AS report,
       SUM(jl.debit) - SUM(jl.credit) AS closing_balance
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
JOIN   accounts a         ON a.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date <= '2026-08-02'::date
  AND  a.code = '1001';


-- ── 5. What the status filter now excludes ─────────────────────────────────
-- Before the fix these were silently included in every report.
SELECT je.status, COUNT(*) AS entries, SUM(jl.debit) AS debits
FROM   journal_entries je
JOIN   journal_lines   jl ON jl.journal_entry_id = je.id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
GROUP  BY je.status;
