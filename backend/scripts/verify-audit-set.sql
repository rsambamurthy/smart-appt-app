-- ============================================================================
--  Verify the four statements agree.  READ-ONLY.
--
--  Trial Balance, Income & Expenditure, Balance Sheet and Receipts & Payments
--  all read the same POSTED journal lines, so specific relationships must hold.
--  Anything non-zero in a "difference" column is a defect.
-- ============================================================================


-- ── 1. I&E surplus must equal the Balance Sheet's net surplus ───────────────
-- Both are income less expenditure over the same span, so they cannot differ.
WITH ie AS (
  SELECT
    SUM(CASE WHEN a.type = 'INCOME'  THEN jl.credit - jl.debit ELSE 0 END) AS income,
    SUM(CASE WHEN a.type = 'EXPENSE' THEN jl.debit  - jl.credit ELSE 0 END) AS expenditure
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  JOIN accounts a         ON a.id = jl.account_id
  WHERE je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND je.status = 'POSTED'
    AND je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
    AND a.is_active AND NOT a.is_group
)
SELECT 'I&E' AS report, income, expenditure, income - expenditure AS surplus FROM ie;


-- ── 2. Balance sheet identity, as of the period end ─────────────────────────
WITH bs AS (
  SELECT
    SUM(CASE WHEN a.type = 'ASSET'     THEN jl.debit  - jl.credit ELSE 0 END) AS assets,
    SUM(CASE WHEN a.type = 'LIABILITY' THEN jl.credit - jl.debit  ELSE 0 END) AS liabilities,
    SUM(CASE WHEN a.type = 'EQUITY'    THEN jl.credit - jl.debit  ELSE 0 END) AS equity,
    SUM(CASE WHEN a.type = 'INCOME'    THEN jl.credit - jl.debit  ELSE 0 END)
  - SUM(CASE WHEN a.type = 'EXPENSE'   THEN jl.debit  - jl.credit ELSE 0 END) AS net_surplus
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  JOIN accounts a         ON a.id = jl.account_id
  WHERE je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND je.status = 'POSTED'
    AND je.entry_date <= '2026-08-02'::date
    AND a.is_active AND NOT a.is_group
)
SELECT 'Balance Sheet' AS report, assets, liabilities, equity, net_surplus,
       assets - (liabilities + equity + net_surplus) AS difference   -- must be 0.00
FROM bs;


-- ── 3. Each schedule must sum to its control account ────────────────────────
-- The per-BP breakdown shown under the balance sheet must reconcile to the
-- control account total. A gap is untagged lines.
SELECT a.code, a.name,
       SUM(jl.debit - jl.credit)                                            AS control_total,
       SUM(CASE WHEN jl.business_partner_id IS NOT NULL
                THEN jl.debit - jl.credit ELSE 0 END)                       AS schedule_total,
       SUM(CASE WHEN jl.business_partner_id IS NULL
                THEN jl.debit - jl.credit ELSE 0 END)                       AS untagged  -- must be 0.00
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
JOIN   accounts a         ON a.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date <= '2026-08-02'::date
  AND  a.is_control_account
GROUP  BY a.code, a.name;


-- ── 4. Why I&E and R&P differ ──────────────────────────────────────────────
-- They SHOULD differ. This reconciles one to the other so the gap can be
-- explained rather than argued about.
--   surplus (accrual)  - dues billed not collected
--                      + cash received against earlier billing
--                      - assets bought with cash (not expenditure)
--                      = net cash movement
WITH cash AS (
  SELECT id FROM accounts WHERE association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid AND code IN ('1001','1002')
)
SELECT 'net cash movement' AS item,
       SUM(jl.debit - jl.credit) AS amount
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
  AND  jl.account_id IN (SELECT id FROM cash)
UNION ALL
SELECT 'receivable movement (billed not collected)',
       SUM(jl.debit - jl.credit)
FROM   journal_lines jl
JOIN   journal_entries je ON je.id = jl.journal_entry_id
JOIN   accounts a         ON a.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
  AND  a.is_control_account;


-- ── 5. Prior-year comparative sanity ───────────────────────────────────────
-- If this returns no rows there is no prior-year data and the comparative
-- column will read as zeros — expected for a first year, misleading otherwise.
SELECT MIN(je.entry_date) AS earliest_entry,
       MAX(je.entry_date) AS latest_entry,
       COUNT(*)           AS posted_entries
FROM   journal_entries je
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED';
