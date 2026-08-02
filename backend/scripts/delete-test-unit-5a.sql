-- ============================================================================
--  Hard-delete the test unit 5A from Park Avenue Apartments.
--
--  Unit:  31fb210d-b0b2-4ec3-bd33-4188aeace357  (flat 5A, currently soft-deleted)
--
--  Every table that can reference a unit is checked first. The delete only
--  runs if all of them are clear, so this cannot quietly orphan anything.
--
--  Transaction-wrapped. Inspect the counts, then COMMIT or ROLLBACK.
-- ============================================================================

BEGIN;

-- ── 1. Is anything still pointing at it? Every count must be 0 ──────────────
SELECT
  (SELECT count(*) FROM users               WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS users,
  (SELECT count(*) FROM user_invites        WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS invites,
  (SELECT count(*) FROM maintenance_tickets WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS tickets,
  (SELECT count(*) FROM bills               WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS bills,
  (SELECT count(*) FROM payments            WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS payments,
  (SELECT count(*) FROM visitors            WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS visitors,
  (SELECT count(*) FROM frequent_visitors   WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS freq_visitors,
  (SELECT count(*) FROM business_partners   WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid) AS bp_cards,
  -- target_unit_ids is a text[], not a foreign key, so nothing enforces it.
  (SELECT count(*) FROM one_time_dues
     WHERE '31fb210d-b0b2-4ec3-bd33-4188aeace357' = ANY(target_unit_ids))                                 AS one_time_dues;

-- ── 2. Guard: refuse to delete while anything references it ─────────────────
DO $$
DECLARE refs int;
BEGIN
  SELECT
    (SELECT count(*) FROM users               WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM user_invites        WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM maintenance_tickets WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM bills               WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM payments            WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM visitors            WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM frequent_visitors   WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM business_partners   WHERE unit_id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid)
  + (SELECT count(*) FROM one_time_dues
       WHERE '31fb210d-b0b2-4ec3-bd33-4188aeace357' = ANY(target_unit_ids))
  INTO refs;

  IF refs > 0 THEN
    RAISE EXCEPTION 'Unit 5A still has % reference(s). Nothing deleted — investigate before retrying.', refs;
  END IF;
END $$;

-- ── 3. Delete ───────────────────────────────────────────────────────────────
DELETE FROM units
WHERE  id = '31fb210d-b0b2-4ec3-bd33-4188aeace357'::uuid
  AND  association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid;
-- Expect: DELETE 1

-- ── 4. After — 12 units, all active, 1A to 4C ───────────────────────────────
SELECT flat_number, block, floor, deleted_at
FROM   units
WHERE  association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
ORDER  BY flat_number;

-- COMMIT;   -- or ROLLBACK;
