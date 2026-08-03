-- ============================================================================
--  Verify the module subscription migration.
--
--  Run these AFTER deploying. Read-only — nothing here changes data.
--
--  The important one is the first query. start.sh has a self-healing fallback
--  that, if `migrate deploy` fails, marks every migration as applied without
--  running it. For a brand-new migration that means the table silently does
--  not exist — and because requireModule now sits on the accounting router,
--  every accounting request would return 500 for a live association.
-- ============================================================================

-- ── 1. Did the migration actually run? ──────────────────────────────────────
-- Expect: association_modules
-- If this is NULL, STOP. Apply the migration file by hand before anyone
-- touches accounting.
SELECT to_regclass('public.association_modules') AS table_exists;


-- ── 2. Is the migration recorded as applied? ────────────────────────────────
-- If row 1 was NULL and this shows the migration as applied, the fallback
-- baselined it without executing it. That is the failure mode to catch.
SELECT migration_name,
       finished_at,
       rolled_back_at,
       applied_steps_count
FROM   _prisma_migrations
WHERE  migration_name LIKE '%association_modules%';


-- ── 3. Every association grandfathered, nobody missed ───────────────────────
-- Expect two rows per active association: ACCOUNTING and GOVERNANCE, both
-- ACTIVE, expires_on NULL.
SELECT a.name,
       m.module,
       m.status,
       m.starts_on,
       m.expires_on,
       m.note
FROM   associations a
LEFT   JOIN association_modules m ON m.association_id = a.id
WHERE  a.is_active = true
ORDER  BY a.name, m.module;


-- ── 4. Anyone left without an entitlement? ──────────────────────────────────
-- Expect zero rows. A non-empty result means an active association will meet
-- a 402 the next time they open accounting.
SELECT a.id, a.name, 'no module rows at all' AS problem
FROM   associations a
WHERE  a.is_active = true
  AND  NOT EXISTS (SELECT 1 FROM association_modules m WHERE m.association_id = a.id)

UNION ALL

SELECT a.id, a.name, 'missing ' || k.module::text
FROM   associations a
CROSS  JOIN (VALUES ('ACCOUNTING'::"ModuleKey"), ('GOVERNANCE'::"ModuleKey")) AS k(module)
WHERE  a.is_active = true
  AND  NOT EXISTS (
         SELECT 1 FROM association_modules m
         WHERE  m.association_id = a.id AND m.module = k.module
       );


-- ── 5. What each association would experience right now ─────────────────────
-- Mirrors resolveAccess() in entitlement.service.ts. If this disagrees with
-- what the app shows, the two have drifted and the service is authoritative.
SELECT a.name,
       m.module,
       m.status,
       m.expires_on,
       CASE
         WHEN m.id IS NULL                        THEN 'NONE       — module hidden'
         WHEN m.status = 'CANCELLED'              THEN 'READ_ONLY  — cancelled'
         WHEN m.expires_on IS NULL                THEN 'FULL       — perpetual'
         WHEN m.expires_on >= CURRENT_DATE        THEN 'FULL       — ' || (m.expires_on - CURRENT_DATE) || ' days left'
         ELSE                                          'READ_ONLY  — expired ' || (CURRENT_DATE - m.expires_on) || ' days ago'
       END AS effective_access
FROM   associations a
LEFT   JOIN association_modules m ON m.association_id = a.id
WHERE  a.is_active = true
ORDER  BY a.name, m.module;


-- ── 6. Renewal chase-list ───────────────────────────────────────────────────
-- What lapses in the next 30 days. Should match the Subscriptions screen.
SELECT a.name,
       m.module,
       m.status,
       m.expires_on,
       m.expires_on - CURRENT_DATE AS days_left,
       m.amount,
       m.reference
FROM   association_modules m
JOIN   associations a ON a.id = m.association_id
WHERE  m.status = 'ACTIVE'
  AND  m.expires_on IS NOT NULL
  AND  m.expires_on <= CURRENT_DATE + INTERVAL '30 days'
ORDER  BY m.expires_on;
