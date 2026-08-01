-- ============================================================================
--  DISCOVERY — find Unit 5A and its August 2026 bill without assuming names.
--  All read-only. Run each step and see which one returns data.
--
--  NOTE: Lite and Gold have SEPARATE databases. Make sure you are connected to
--  the one that shows the problem (you said Lite).
-- ============================================================================


-- ─── STEP A: Which database am I actually connected to? ─────────────────────
SELECT current_database()                          AS database_name,
       (SELECT COUNT(*) FROM associations)         AS associations,
       (SELECT COUNT(*) FROM units)                AS units,
       (SELECT COUNT(*) FROM bills)                AS bills;


-- ─── STEP B: List every association (exact spelling matters) ────────────────
SELECT id, name, city, created_at
FROM   associations
ORDER  BY name;


-- ─── STEP C: Find any unit that looks like "5A" — case/space tolerant ───────
-- Also covers the case where block and flat are stored separately.
SELECT u.id           AS unit_id,
       a.name         AS association,
       u.block,
       u.flat_number,
       u.deleted_at,
       CASE WHEN u.deleted_at IS NULL THEN 'active' ELSE 'SOFT-DELETED' END AS state
FROM   units u
JOIN   associations a ON a.id = u.association_id
WHERE  REPLACE(UPPER(u.flat_number), ' ', '') LIKE '%5A%'
   OR  REPLACE(UPPER(COALESCE(u.block, '') || u.flat_number), ' ', '') LIKE '%5A%'
ORDER  BY a.name, u.flat_number;


-- ─── STEP D: Every bill for August 2026, with its unit ──────────────────────
-- Find the 5A row here and note its bill_id + unit_id.
SELECT b.id           AS bill_id,
       a.name         AS association,
       u.block,
       u.flat_number,
       u.deleted_at   AS unit_deleted_on,
       b.total_amount,
       b.status,
       b.due_date
FROM   bills b
JOIN   units u        ON u.id = b.unit_id
JOIN   associations a ON a.id = b.association_id
WHERE  b.period_year  = 2026
  AND  b.period_month = 8
ORDER  BY a.name, u.flat_number;


-- ─── STEP E: Every bill belonging to a soft-deleted unit (any period) ───────
-- This is the full footprint of the bug in this database.
SELECT a.name         AS association,
       u.flat_number,
       u.deleted_at   AS unit_deleted_on,
       b.period_year,
       b.period_month,
       b.total_amount,
       b.status,
       (SELECT COUNT(*) FROM payments p WHERE p.bill_id = b.id) AS payments
FROM   bills b
JOIN   units u        ON u.id = b.unit_id
JOIN   associations a ON a.id = b.association_id
WHERE  u.deleted_at IS NOT NULL
ORDER  BY a.name, u.flat_number, b.period_year, b.period_month;


-- ============================================================================
--  Once STEP D shows you the bill, delete it BY ID (safest — no name matching).
--  Replace the UUID below with the bill_id from Step D.
-- ============================================================================

-- BEGIN;
--
--   -- Confirm no payments are attached first:
--   SELECT COUNT(*) FROM payments WHERE bill_id = 'PASTE-BILL-ID-HERE';
--   -- must return 0
--
--   DELETE FROM bills WHERE id = 'PASTE-BILL-ID-HERE';
--   -- should print "DELETE 1"
--
-- COMMIT;   -- or ROLLBACK; if anything looks wrong
