-- Verify the statement of account against the raw ledger.
--
-- The statement is only worth having if it agrees with the tables it reads.
-- Run these against Gold (smart-appt-app-development) and compare with the
-- Statement of Account screen.
--
-- Replace :assoc with the association id.

\set assoc '00000000-0000-0000-0000-000000000000'

-- 1. Association-wide position as at today.
--    Must equal the two tiles at the top of the Statement screen.
--    Credits are NOT netted against arrears, so these are two separate sums.
WITH bal AS (
  SELECT u.id,
         COALESCE((SELECT SUM(b.total_amount) FROM bills b
                    WHERE b.unit_id = u.id AND b.due_date <= CURRENT_DATE), 0)
       - COALESCE((SELECT SUM(p.amount) FROM payments p
                    WHERE p.unit_id = u.id AND p.payment_date <= CURRENT_DATE + 1), 0)
         AS balance
    FROM units u
   WHERE u.association_id = :'assoc'::uuid AND u.deleted_at IS NULL
)
SELECT ROUND(SUM(balance) FILTER (WHERE balance > 0), 2)        AS outstanding,
       ROUND(ABS(SUM(balance) FILTER (WHERE balance < 0)), 2)   AS in_credit,
       COUNT(*) FILTER (WHERE balance > 0)                      AS flats_owing,
       COUNT(*)                                                 AS flats_total
  FROM bal;

-- 2. One flat's closing balance.
--    Must equal the Closing balance line on that flat's statement.
--    Set the flat number first.
\set flat 'A-101'

WITH u AS (
  SELECT id, flat_number FROM units
   WHERE association_id = :'assoc'::uuid AND flat_number = :'flat' AND deleted_at IS NULL
)
SELECT u.flat_number,
       ROUND(COALESCE((SELECT SUM(b.total_amount) FROM bills b WHERE b.unit_id = u.id), 0), 2)  AS billed_ever,
       ROUND(COALESCE((SELECT SUM(p.amount)       FROM payments p WHERE p.unit_id = u.id), 0), 2) AS paid_ever,
       ROUND(COALESCE((SELECT SUM(b.total_amount) FROM bills b WHERE b.unit_id = u.id), 0)
           - COALESCE((SELECT SUM(p.amount)       FROM payments p WHERE p.unit_id = u.id), 0), 2) AS balance
  FROM u;

-- 3. The same flat's lines, in the order the statement draws them.
--    Charges sort before payments on the same day: you cannot pay a bill
--    before it exists. The running balance here should match column 5 exactly.
WITH u AS (
  SELECT id FROM units
   WHERE association_id = :'assoc'::uuid AND flat_number = :'flat' AND deleted_at IS NULL
), entries AS (
  SELECT b.due_date::date AS at, 0 AS ord,
         COALESCE(b.bill_label, 'Maintenance ' || b.period_month || '/' || b.period_year) AS particulars,
         b.total_amount AS amount
    FROM bills b JOIN u ON u.id = b.unit_id
  UNION ALL
  SELECT p.payment_date::date, 1,
         'Payment ' || p.payment_mode || COALESCE(' ' || p.reference_no, ''),
         -p.amount
    FROM payments p JOIN u ON u.id = p.unit_id
)
SELECT at, particulars, amount,
       ROUND(SUM(amount) OVER (ORDER BY at, ord ROWS UNBOUNDED PRECEDING), 2) AS running_balance
  FROM entries
 ORDER BY at, ord;

-- 4. Bills with no due date or a zero total — these break a dated ledger and
--    should come back empty.
SELECT id, unit_id, period_month, period_year, total_amount, due_date
  FROM bills
 WHERE association_id = :'assoc'::uuid
   AND (due_date IS NULL OR total_amount IS NULL OR total_amount = 0)
 LIMIT 20;

-- 5. Payments not attached to any unit, or dated in the future. A future-dated
--    payment silently disappears from an as-at-today statement.
SELECT id, unit_id, amount, payment_date, payment_mode
  FROM payments
 WHERE association_id = :'assoc'::uuid
   AND (unit_id IS NULL OR payment_date > NOW())
 LIMIT 20;

-- 6. Sanity: does the arrears screen agree with the statement screen?
--    Arrears counts only overdue bills; the statement counts everything billed.
--    They will differ if bills exist with a due date in the future — that is
--    expected, and this query shows how much of the gap that explains.
SELECT ROUND(COALESCE(SUM(b.total_amount), 0), 2) AS billed_not_yet_due,
       COUNT(*) AS bill_count
  FROM bills b
 WHERE b.association_id = :'assoc'::uuid
   AND b.due_date > CURRENT_DATE;
