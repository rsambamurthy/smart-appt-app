-- ============================================================================
--  Verify the governance migration and the voting rules.
--
--  Run AFTER deploying. Read-only.
--
--  Query 1 is a gate. start.sh has a self-healing fallback that, if
--  `migrate deploy` fails, marks every migration as applied without running
--  it. For a new migration that means the tables silently do not exist and
--  every /governance request returns 500.
-- ============================================================================

-- ── 1. Did the migration run? ───────────────────────────────────────────────
-- All five must be non-null. If any is null, STOP and apply the file by hand.
SELECT to_regclass('public.governance_config')  AS governance_config,
       to_regclass('public.meetings')           AS meetings,
       to_regclass('public.agenda_items')       AS agenda_items,
       to_regclass('public.meeting_attendees')  AS meeting_attendees,
       to_regclass('public.resolution_votes')   AS resolution_votes;


-- ── 2. Every association seeded with config ─────────────────────────────────
-- Expect zero rows.
SELECT a.id, a.name
FROM   associations a
WHERE  a.is_active = true
  AND  NOT EXISTS (SELECT 1 FROM governance_config g WHERE g.association_id = a.id);


-- ── 3. One vote per flat — the constraint that matters most ─────────────────
-- Expect zero rows. A non-empty result means the unique index is missing and
-- a flat has voted more than once on the same resolution.
SELECT agenda_item_id, unit_id, COUNT(*) AS votes
FROM   resolution_votes
GROUP  BY agenda_item_id, unit_id
HAVING COUNT(*) > 1;

-- Same for attendance: one register row per flat per meeting.
SELECT meeting_id, unit_id, COUNT(*) AS rows_found
FROM   meeting_attendees
GROUP  BY meeting_id, unit_id
HAVING COUNT(*) > 1;


-- ── 4. Confirm the indexes exist ────────────────────────────────────────────
-- Expect both. Query 3 passing on an empty table proves nothing.
SELECT indexname
FROM   pg_indexes
WHERE  tablename IN ('resolution_votes', 'meeting_attendees')
  AND  indexdef LIKE '%UNIQUE%'
ORDER  BY indexname;


-- ── 5. Do the recorded outcomes match the votes? ────────────────────────────
-- Recomputes every closed resolution the way closeVotingIn() does: abstentions
-- are excluded from the denominator, and a resolution with no decisive votes
-- is DEFEATED rather than carried by a vacuous majority.
--
-- Expect `agrees` to be true on every row. A false means the stored outcome
-- and the votes have diverged — which would be a serious bug, since the
-- outcome is the statutory record.
WITH counts AS (
  SELECT ai.id,
         ai.title,
         ai.pass_threshold_percent,
         ai.outcome,
         COUNT(*) FILTER (WHERE rv.choice = 'FOR')     AS votes_for,
         COUNT(*) FILTER (WHERE rv.choice = 'AGAINST') AS votes_against,
         COUNT(*) FILTER (WHERE rv.choice = 'ABSTAIN') AS abstained
  FROM   agenda_items ai
  LEFT   JOIN resolution_votes rv ON rv.agenda_item_id = ai.id
  WHERE  ai.voting_status = 'CLOSED'
  GROUP  BY ai.id, ai.title, ai.pass_threshold_percent, ai.outcome
)
SELECT title,
       votes_for,
       votes_against,
       abstained,
       pass_threshold_percent,
       outcome AS recorded,
       CASE
         WHEN votes_for + votes_against = 0 THEN 'DEFEATED'
         WHEN (votes_for::numeric / (votes_for + votes_against)) * 100
              >= pass_threshold_percent    THEN 'CARRIED'
         ELSE 'DEFEATED'
       END AS recomputed,
       outcome::text = CASE
         WHEN votes_for + votes_against = 0 THEN 'DEFEATED'
         WHEN (votes_for::numeric / (votes_for + votes_against)) * 100
              >= pass_threshold_percent    THEN 'CARRIED'
         ELSE 'DEFEATED'
       END AS agrees
FROM   counts
ORDER  BY title;


-- ── 6. Quorum, recomputed ───────────────────────────────────────────────────
-- Compares present flats against the requirement SNAPSHOTTED at notice, not
-- against today's unit count. A flat added after notice must not move the bar.
SELECT m.title,
       m.status,
       m.eligible_units,
       m.quorum_percent,
       CEIL((m.quorum_percent / 100) * m.eligible_units) AS required,
       COUNT(*) FILTER (WHERE ma.attended)               AS present,
       COUNT(*) FILTER (WHERE ma.attended)
         >= CEIL((m.quorum_percent / 100) * m.eligible_units) AS quorum_met
FROM   meetings m
LEFT   JOIN meeting_attendees ma ON ma.meeting_id = m.id
WHERE  m.eligible_units IS NOT NULL
GROUP  BY m.id, m.title, m.status, m.eligible_units, m.quorum_percent
ORDER  BY m.scheduled_at DESC;


-- ── 7. Votes cast by flats that never existed as members ────────────────────
-- Sanity check on scoping: every vote should belong to a unit in the same
-- association as the meeting. Expect zero rows.
SELECT rv.id, m.title, u.flat_number
FROM   resolution_votes rv
JOIN   agenda_items ai ON ai.id = rv.agenda_item_id
JOIN   meetings m      ON m.id  = ai.meeting_id
JOIN   units u         ON u.id  = rv.unit_id
WHERE  u.association_id <> m.association_id;
