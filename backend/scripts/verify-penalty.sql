-- Verify late-payment penalties against the ledger.
--
-- Everything here should return NO ROWS except queries 1 and 6, which are
-- summaries. A row anywhere else is a real inconsistency.
--
-- Run against Gold (smart-appt-app-development).

\set assoc '00000000-0000-0000-0000-000000000000'

-- 1. Summary: what has been charged and what has been let off.
SELECT COUNT(*)                                             AS penalties_total,
       COUNT(*) FILTER (WHERE waived_at IS NULL)            AS live,
       COUNT(*) FILTER (WHERE waived_at IS NOT NULL)        AS waived,
       ROUND(COALESCE(SUM(amount) FILTER (WHERE waived_at IS NULL), 0), 2)     AS live_amount,
       ROUND(COALESCE(SUM(amount) FILTER (WHERE waived_at IS NOT NULL), 0), 2) AS waived_amount
  FROM bill_penalties
 WHERE association_id = :'assoc'::uuid;

-- 2. bills.penalty must equal the sum of that bill's LIVE penalty rows.
--    This is the denormalisation that every other screen trusts. If it drifts,
--    the statement and the bill disagree and nobody can tell which is right.
SELECT b.id AS bill_id, u.flat_number, b.period_month, b.period_year,
       ROUND(b.penalty, 2)                       AS bill_says,
       ROUND(COALESCE(SUM(p.amount), 0), 2)      AS penalties_say
  FROM bills b
  JOIN units u ON u.id = b.unit_id
  LEFT JOIN bill_penalties p ON p.bill_id = b.id AND p.waived_at IS NULL
 WHERE b.association_id = :'assoc'::uuid
 GROUP BY b.id, u.flat_number, b.period_month, b.period_year, b.penalty
HAVING ROUND(b.penalty, 2) <> ROUND(COALESCE(SUM(p.amount), 0), 2);

-- 3. bills.total_amount must equal base + levy + live penalty.
SELECT b.id AS bill_id, u.flat_number,
       ROUND(b.total_amount, 2)                                  AS total_says,
       ROUND(b.base_amount + b.levy_amount + b.penalty, 2)        AS parts_say
  FROM bills b JOIN units u ON u.id = b.unit_id
 WHERE b.association_id = :'assoc'::uuid
   AND ROUND(b.total_amount, 2)
       <> ROUND(b.base_amount + b.levy_amount + b.penalty, 2);

-- 4. Every penalty must have a journal entry, and every waiver must have its
--    reversing entry. A charge with no entry means a resident was billed for
--    something that never reached the books.
SELECT p.id AS penalty_id, u.flat_number, p.amount, p.charged_on,
       (p.waived_at IS NOT NULL) AS waived,
       je_charge.id  AS charge_entry,
       je_waive.id   AS waiver_entry
  FROM bill_penalties p
  JOIN bills b ON b.id = p.bill_id
  JOIN units u ON u.id = b.unit_id
  LEFT JOIN journal_entries je_charge
         ON je_charge.reference_type = 'BILL_PENALTY'
        AND je_charge.reference_id   = p.id
  LEFT JOIN journal_entries je_waive
         ON je_waive.reference_type = 'BILL_PENALTY_WAIVER'
        AND je_waive.reference_id   = p.id
 WHERE p.association_id = :'assoc'::uuid
   AND (je_charge.id IS NULL
        OR (p.waived_at IS NOT NULL AND je_waive.id IS NULL)
        OR (p.waived_at IS NULL     AND je_waive.id IS NOT NULL));

-- 5. Every penalty journal entry must balance and must hit exactly 1004/3004.
SELECT je.id, je.reference_code, je.voucher_type,
       ROUND(SUM(l.debit), 2)  AS debits,
       ROUND(SUM(l.credit), 2) AS credits,
       string_agg(a.code, ',' ORDER BY a.code) AS accounts
  FROM journal_entries je
  JOIN journal_lines l ON l.journal_entry_id = je.id
  JOIN accounts a ON a.id = l.account_id
 WHERE je.association_id = :'assoc'::uuid
   AND je.reference_type IN ('BILL_PENALTY', 'BILL_PENALTY_WAIVER')
 GROUP BY je.id, je.reference_code, je.voucher_type
HAVING ROUND(SUM(l.debit), 2) <> ROUND(SUM(l.credit), 2)
    OR string_agg(a.code, ',' ORDER BY a.code) <> '1004,3004';

-- 6. Net effect on Penalty Income: charges less waivers. Should equal the
--    `live_amount` from query 1.
SELECT ROUND(SUM(l.credit) - SUM(l.debit), 2) AS net_penalty_income
  FROM journal_entries je
  JOIN journal_lines l ON l.journal_entry_id = je.id
  JOIN accounts a ON a.id = l.account_id
 WHERE je.association_id = :'assoc'::uuid
   AND a.code = '3004'
   AND je.reference_type IN ('BILL_PENALTY', 'BILL_PENALTY_WAIVER');

-- 7. The 1004 leg of every penalty entry must carry a business partner, or the
--    charge is invisible in the per-flat sub-ledger.
SELECT je.reference_code, u.flat_number, l.debit, l.credit
  FROM journal_entries je
  JOIN journal_lines l ON l.journal_entry_id = je.id
  JOIN accounts a ON a.id = l.account_id
  JOIN bill_penalties p ON p.id = je.reference_id
  JOIN bills b ON b.id = p.bill_id
  JOIN units u ON u.id = b.unit_id
 WHERE je.association_id = :'assoc'::uuid
   AND je.reference_type IN ('BILL_PENALTY', 'BILL_PENALTY_WAIVER')
   AND a.code = '1004'
   AND l.business_partner_id IS NULL;

-- 8. More than one live penalty on a bill. The partial unique index should
--    make this impossible; this query is here to prove the index survived.
SELECT bill_id, COUNT(*)
  FROM bill_penalties
 WHERE association_id = :'assoc'::uuid AND waived_at IS NULL
 GROUP BY bill_id
HAVING COUNT(*) > 1;

-- 9. Penalties charged inside the grace period — the rule not being applied.
SELECT p.id, u.flat_number, b.due_date, p.charged_on, p.days_overdue, p.grace_days
  FROM bill_penalties p
  JOIN bills b ON b.id = p.bill_id
  JOIN units u ON u.id = b.unit_id
 WHERE p.association_id = :'assoc'::uuid
   AND p.days_overdue <= p.grace_days;

-- 10. Waivers missing their reason or their author. The CHECK constraint
--     should prevent this; a row here means the constraint was dropped.
SELECT id, bill_id, waived_at, waived_by, waive_reason
  FROM bill_penalties
 WHERE association_id = :'assoc'::uuid
   AND waived_at IS NOT NULL
   AND (waived_by IS NULL OR waive_reason IS NULL OR btrim(waive_reason) = '');
