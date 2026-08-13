-- ============================================================================
--  Verify the Receipts & Payments Account.  READ-ONLY.
--
--  R&P is cash-basis: it must reconcile to the movement on the cash and bank
--  accounts and to nothing else. Run for the same period as the app and
--  compare.
-- ============================================================================


-- ── 1. The identity that must hold ──────────────────────────────────────────
-- closing = opening + receipts - payments, on cash accounts only.
WITH cash AS (
  SELECT id FROM accounts
  WHERE association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid AND code IN ('1001', '1002')
),
mv AS (
  SELECT
    SUM(CASE WHEN je.entry_date <  '2026-04-01'::date THEN jl.debit - jl.credit ELSE 0 END) AS opening,
    SUM(CASE WHEN je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date THEN jl.debit  ELSE 0 END) AS receipts_gross,
    SUM(CASE WHEN je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date THEN jl.credit ELSE 0 END) AS payments_gross,
    SUM(CASE WHEN je.entry_date <= '2026-08-02'::date   THEN jl.debit - jl.credit ELSE 0 END) AS closing
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND je.status = 'POSTED'
    AND jl.account_id IN (SELECT id FROM cash)
)
SELECT 'cash movement' AS check, opening, receipts_gross, payments_gross, closing,
       closing - (opening + receipts_gross - payments_gross) AS difference  -- must be 0.00
FROM mv;
-- NOTE: receipts_gross / payments_gross here INCLUDE contra transfers between
-- cash and bank. The app excludes those, so its receipts and payments totals
-- will be lower by the contra amount while the closing balance still agrees.


-- ── 2. Contra entries — cash moved between cash accounts only ───────────────
-- These are the ones the app excludes. Each should net to zero across cash.
WITH cash AS (
  SELECT id FROM accounts
  WHERE association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid AND code IN ('1001', '1002')
)
SELECT je.entry_date, je.reference_code, je.narration,
       SUM(CASE WHEN jl.account_id IN (SELECT id FROM cash) THEN jl.debit - jl.credit ELSE 0 END) AS cash_net,
       COUNT(*) FILTER (WHERE jl.account_id NOT IN (SELECT id FROM cash))                         AS non_cash_lines
FROM   journal_entries je
JOIN   journal_lines   jl ON jl.journal_entry_id = je.id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
  AND  je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
  AND  EXISTS (SELECT 1 FROM journal_lines x WHERE x.journal_entry_id = je.id AND x.account_id IN (SELECT id FROM cash))
GROUP  BY je.id, je.entry_date, je.reference_code, je.narration
HAVING ABS(SUM(CASE WHEN jl.account_id IN (SELECT id FROM cash) THEN jl.debit - jl.credit ELSE 0 END)) < 0.005
ORDER  BY je.entry_date;


-- ── 3. Receipts by contra account — compare with the app's left column ──────
WITH cash AS (
  SELECT id FROM accounts
  WHERE association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid AND code IN ('1001', '1002')
),
ent AS (
  SELECT je.id,
         SUM(CASE WHEN jl.account_id IN (SELECT id FROM cash) THEN jl.debit - jl.credit ELSE 0 END) AS cash_net
  FROM   journal_entries je
  JOIN   journal_lines   jl ON jl.journal_entry_id = je.id
  WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND  je.status = 'POSTED'
    AND  je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
  GROUP  BY je.id
)
SELECT a.code, a.name, SUM(jl.credit - jl.debit) AS amount
FROM   ent
JOIN   journal_lines jl ON jl.journal_entry_id = ent.id
JOIN   accounts a       ON a.id = jl.account_id
WHERE  ent.cash_net > 0.005
  AND  jl.account_id NOT IN (SELECT id FROM cash)
GROUP  BY a.code, a.name
HAVING SUM(jl.credit - jl.debit) <> 0
ORDER  BY a.code;


-- ── 4. Payments by contra account — compare with the app's right column ─────
WITH cash AS (
  SELECT id FROM accounts
  WHERE association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid AND code IN ('1001', '1002')
),
ent AS (
  SELECT je.id,
         SUM(CASE WHEN jl.account_id IN (SELECT id FROM cash) THEN jl.debit - jl.credit ELSE 0 END) AS cash_net
  FROM   journal_entries je
  JOIN   journal_lines   jl ON jl.journal_entry_id = je.id
  WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND  je.status = 'POSTED'
    AND  je.entry_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
  GROUP  BY je.id
)
SELECT a.code, a.name, SUM(jl.debit - jl.credit) AS amount
FROM   ent
JOIN   journal_lines jl ON jl.journal_entry_id = ent.id
JOIN   accounts a       ON a.id = jl.account_id
WHERE  ent.cash_net < -0.005
  AND  jl.account_id NOT IN (SELECT id FROM cash)
GROUP  BY a.code, a.name
HAVING SUM(jl.debit - jl.credit) <> 0
ORDER  BY a.code;


-- ── 5. R&P versus Income & Expenditure ─────────────────────────────────────
-- These SHOULD differ. Dues billed but unpaid are income without a receipt;
-- a fixed deposit is a payment without an expense. This quantifies the gap so
-- it can be explained rather than discovered at audit.
SELECT 'dues billed but unpaid' AS item,
       SUM(b.total_amount) - COALESCE((
         SELECT SUM(p.amount) FROM payments p
         WHERE p.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
           AND p.payment_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date), 0) AS amount
FROM   bills b
WHERE  b.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  b.due_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
UNION ALL
SELECT 'paid but not expenditure (assets)',
       COALESCE(SUM(e.amount), 0)
FROM   expenses e
WHERE  e.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  e.deleted_at IS NULL
  AND  e.expense_date BETWEEN '2026-04-01'::date AND '2026-08-02'::date
  AND  (e.category ILIKE '%deposit%' OR e.description ILIKE '%fixed deposit%');
