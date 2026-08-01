-- ============================================================================
--  Remove the August 2026 bill for Unit 5A (Park Avenue)
--
--  Run the STEPS IN ORDER. Steps 1–3 are read-only; nothing is deleted until
--  you run Step 5 yourself.
--
--  Background: Unit 5A was soft-deleted (units.deleted_at is set) but bill
--  generation ignored that flag, so bills kept being created for it.
-- ============================================================================


-- ─── STEP 1: Confirm the association and the unit ───────────────────────────
-- Expect: one row, with deleted_at NOT NULL (that's why it vanished from
-- Manage Units). Note the unit id — you'll see it referenced below.

SELECT u.id            AS unit_id,
       u.flat_number,
       u.block,
       u.deleted_at,
       a.name          AS association
FROM   units u
JOIN   associations a ON a.id = u.association_id
WHERE  a.name = 'Park Avenue'
  AND  u.flat_number = '5A';


-- ─── STEP 2: Look at the bill(s) you are about to remove ────────────────────
-- Expect: the August 2026 bill. Check the amount and status look right.

SELECT b.id            AS bill_id,
       b.period_month,
       b.period_year,
       b.total_amount,
       b.status,
       b.due_date,
       b.created_at
FROM   bills b
JOIN   units u        ON u.id = b.unit_id
JOIN   associations a ON a.id = b.association_id
WHERE  a.name = 'Park Avenue'
  AND  u.flat_number = '5A'
  AND  b.period_year  = 2026
  AND  b.period_month = 8;


-- ─── STEP 3: SAFETY CHECK — are there payments against that bill? ───────────
-- IMPORTANT: if this returns any rows, STOP and decide what to do.
-- Deleting a bill that has payments would orphan real money records.
-- (If it returns 0 rows, it is safe to continue.)

SELECT p.id            AS payment_id,
       p.amount,
       p.payment_mode,
       p.payment_date,
       p.bill_id
FROM   payments p
WHERE  p.bill_id IN (
         SELECT b.id
         FROM   bills b
         JOIN   units u        ON u.id = b.unit_id
         JOIN   associations a ON a.id = b.association_id
         WHERE  a.name = 'Park Avenue'
           AND  u.flat_number = '5A'
           AND  b.period_year  = 2026
           AND  b.period_month = 8
       );


-- ─── STEP 4: Dry run — count exactly what STEP 5 will delete ────────────────
-- Expect: 1 (or however many bills Step 2 showed).

SELECT COUNT(*) AS bills_that_will_be_deleted
FROM   bills b
JOIN   units u        ON u.id = b.unit_id
JOIN   associations a ON a.id = b.association_id
WHERE  a.name = 'Park Avenue'
  AND  u.flat_number = '5A'
  AND  b.period_year  = 2026
  AND  b.period_month = 8;


-- ─── STEP 5: THE DELETE (only run after Steps 2–4 look correct) ─────────────
-- Wrapped in a transaction. Review the row count, then COMMIT or ROLLBACK.

BEGIN;

DELETE FROM bills b
USING  units u, associations a
WHERE  u.id = b.unit_id
  AND  a.id = b.association_id
  AND  a.name = 'Park Avenue'
  AND  u.flat_number = '5A'
  AND  b.period_year  = 2026
  AND  b.period_month = 8;

-- psql prints e.g. "DELETE 1". If that number matches Step 4:
--     COMMIT;
-- If it does NOT match, or anything looks wrong:
--     ROLLBACK;

-- COMMIT;
-- ROLLBACK;


-- ============================================================================
--  OPTIONAL — find every other bill belonging to a soft-deleted unit.
--  These are the rest of the damage from the same bug. Review before acting;
--  this query only reports, it does not delete.
-- ============================================================================

SELECT a.name          AS association,
       u.flat_number,
       u.deleted_at    AS unit_deleted_on,
       b.period_year,
       b.period_month,
       b.total_amount,
       b.status,
       (SELECT COUNT(*) FROM payments p WHERE p.bill_id = b.id) AS payment_count
FROM   bills b
JOIN   units u        ON u.id = b.unit_id
JOIN   associations a ON a.id = b.association_id
WHERE  u.deleted_at IS NOT NULL
ORDER  BY a.name, u.flat_number, b.period_year, b.period_month;
