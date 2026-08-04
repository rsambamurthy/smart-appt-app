-- Why a control account shows no units, and how to fix it.
--
-- The sub-ledger for a control account is found by ONE join:
--
--     business_partners.bp_type_id = accounts.bp_type_id
--
-- Not by bp_category, not by unit_id. So a unit business partner with a null
-- bp_type_id is invisible to account 1004 no matter how correct it looks in
-- the Business Partners screen.
--
-- Two things break this, and they are different problems:
--
--   1. NO unit BPs exist. Turning 1004 into a control account does not create
--      them — nothing does, automatically. They come from the Units/Flats
--      opening-balance upload or from 04-create-unit-business-partners.sql.
--
--   2. Unit BPs exist but carry no bp_type_id. The opening-balance upload
--      creates them without one, so units added that way never join.
--
-- Run section 1 first. It tells you which of the two you have.

\set assoc '00000000-0000-0000-0000-000000000000'

-- ── 1. Diagnosis ─────────────────────────────────────────────────────────────
SELECT
  a.code,
  a.name,
  a.is_control_account,
  a.bp_type_id                                            AS account_bp_type,
  (SELECT COUNT(*) FROM units u
    WHERE u.association_id = a.association_id
      AND u.deleted_at IS NULL)                           AS units_total,
  (SELECT COUNT(*) FROM business_partners bp
    WHERE bp.association_id = a.association_id
      AND bp.bp_category = 'UNIT')                        AS unit_bps_total,
  (SELECT COUNT(*) FROM business_partners bp
    WHERE bp.association_id = a.association_id
      AND bp.bp_category = 'UNIT'
      AND bp.bp_type_id IS NULL)                          AS unit_bps_untagged,
  (SELECT COUNT(*) FROM business_partners bp
    WHERE bp.association_id = a.association_id
      AND bp.bp_type_id = a.bp_type_id
      AND bp.is_active)                                   AS visible_in_subledger
FROM accounts a
WHERE a.association_id = :'assoc'::uuid
  AND a.code = '1004';

--  units_total > 0 and unit_bps_total = 0        → case 1, go to section 3
--  unit_bps_untagged > 0                          → case 2, go to section 2
--  visible_in_subledger = units_total             → nothing wrong here

-- ── 2. Tag existing unit BPs ─────────────────────────────────────────────────
-- Point every unit BP at whatever BP type account 1004 is using.
-- Safe to re-run; only touches rows that have no type yet.
UPDATE business_partners bp
   SET bp_type_id = a.bp_type_id,
       updated_at = now()
  FROM accounts a
 WHERE a.association_id  = bp.association_id
   AND a.code            = '1004'
   AND a.bp_type_id IS NOT NULL
   AND bp.association_id = :'assoc'::uuid
   AND bp.bp_category    = 'UNIT'
   AND bp.bp_type_id IS NULL;

-- ── 3. Create the missing ones ───────────────────────────────────────────────
-- One BP per active unit that does not already have one. Unlike
-- 04-create-unit-business-partners.sql this is not hardcoded to a single
-- association — it uses :assoc like everything else here.
--
-- created_at / updated_at must be supplied: updated_at is Prisma's @updatedAt,
-- written by the client, with no database default.
INSERT INTO business_partners
  (association_id, code, name, bp_category, bp_type_id, unit_id, is_active,
   created_at, updated_at)
SELECT
  u.association_id,
  left(upper(regexp_replace('UNIT-' || coalesce(u.block, '') || u.flat_number,
                            '[^A-Za-z0-9-]', '', 'g')), 20),
  'Unit ' || u.flat_number || coalesce(' ' || u.block, ''),
  'UNIT'::"BPCategory",
  (SELECT bp_type_id FROM accounts
    WHERE association_id = u.association_id AND code = '1004'),
  u.id,
  true,
  now(),
  now()
  FROM units u
 WHERE u.association_id = :'assoc'::uuid
   AND u.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM business_partners bp WHERE bp.unit_id = u.id
   )
 ORDER BY u.flat_number;

-- ── 4. Prove it ──────────────────────────────────────────────────────────────
-- visible_in_subledger should now equal units_total.
SELECT
  (SELECT COUNT(*) FROM units u
    WHERE u.association_id = :'assoc'::uuid AND u.deleted_at IS NULL) AS units_total,
  (SELECT COUNT(*) FROM business_partners bp
     JOIN accounts a ON a.association_id = bp.association_id AND a.code = '1004'
    WHERE bp.association_id = :'assoc'::uuid
      AND bp.bp_type_id = a.bp_type_id
      AND bp.is_active)                                              AS visible_in_subledger,
  (SELECT COUNT(*) FROM business_partners bp
    WHERE bp.association_id = :'assoc'::uuid
      AND bp.bp_category = 'UNIT'
      AND bp.bp_type_id IS NULL)                                     AS still_untagged;
