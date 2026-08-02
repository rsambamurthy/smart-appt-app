-- ============================================================================
--  One-time: move SUPER_USER accounts out of real associations.
--
--  A super user is not a member of any association — it administers all of
--  them. Parking one inside a tenant caused Park Avenue to disappear from the
--  super user's own association list.
--
--  Creates a system placeholder association and moves every SUPER_USER into
--  it. Safe to re-run: the placeholder is created only if missing, and the
--  move only touches users not already there.
--
--  The user's id does NOT change, so every foreign key pointing at it —
--  journal_entries.created_by_id, posted_by_id, audit_logs, dues_config
--  .updated_by — stays intact. Only association membership moves.
--
--  Transaction-wrapped. Inspect the output, then COMMIT or ROLLBACK.
-- ============================================================================

BEGIN;

-- ── Before ──────────────────────────────────────────────────────────────────
SELECT u.name, u.phone, u.role, a.name AS association, u.unit_id
FROM   users u
JOIN   associations a ON a.id = u.association_id
WHERE  u.role = 'SUPER_USER'
ORDER  BY a.name;

-- ── 1. The system placeholder association ───────────────────────────────────
-- Fixed UUID so this is idempotent and easy to reference later.
INSERT INTO associations (id, name, city, state, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       'SmartAppt System', NULL, NULL, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM associations WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- association_config is expected by parts of the app; create a minimal row.
INSERT INTO association_config (association_id, association_name, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'SmartAppt System', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM association_config
  WHERE association_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- ── 2. Move the super users ─────────────────────────────────────────────────
-- unit_id is cleared: the flat belongs to the association being left behind.
UPDATE users
SET    association_id = '00000000-0000-0000-0000-000000000001'::uuid,
       unit_id        = NULL,
       updated_at     = now()
WHERE  role = 'SUPER_USER'
  AND  association_id <> '00000000-0000-0000-0000-000000000001'::uuid;

-- ── 3. Invalidate their sessions ────────────────────────────────────────────
-- refresh_tokens carry association_id; stale ones would scope the super user
-- to the association they just left. They will simply log in again.
DELETE FROM refresh_tokens
WHERE  user_id IN (SELECT id FROM users WHERE role = 'SUPER_USER');

-- ── After ───────────────────────────────────────────────────────────────────
SELECT u.name, u.phone, u.role, a.name AS association, u.unit_id
FROM   users u
JOIN   associations a ON a.id = u.association_id
WHERE  u.role = 'SUPER_USER';

-- Every real association should now have zero super users.
SELECT a.name,
       COUNT(*) FILTER (WHERE u.role =  'SUPER_USER') AS super_users,
       COUNT(*) FILTER (WHERE u.role <> 'SUPER_USER') AS ordinary_users
FROM   associations a
LEFT   JOIN users u ON u.association_id = a.id
GROUP  BY a.id, a.name
ORDER  BY a.name;

-- COMMIT;   -- or ROLLBACK;
