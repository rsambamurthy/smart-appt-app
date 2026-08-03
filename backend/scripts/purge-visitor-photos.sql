-- ============================================================================
--  Retention: delete gate photos older than the retention period.
--
--  WHY THIS EXISTS
--  Visitor photos are personal data about identifiable people who are not your
--  members and never agreed to anything. Unlike accounting records, there is no
--  reason to keep them indefinitely — their only purpose is to help identify
--  someone shortly after an incident. Left alone, the visitors table would
--  accumulate photographs of everyone who ever walked through the gate.
--
--  This deletes the IMAGE only. The visit record — who came, for which flat,
--  when they entered and left — is kept, so the log stays complete.
--
--  Run monthly, or schedule it. Transaction-wrapped; inspect, then COMMIT.
-- ============================================================================

BEGIN;

-- ── How much is stored right now ────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE photo_data IS NOT NULL)                      AS photos_held,
  pg_size_pretty(COALESCE(SUM(octet_length(photo_data)), 0))          AS total_size,
  MIN(photo_captured_at)                                              AS oldest,
  MAX(photo_captured_at)                                              AS newest
FROM visitors;


-- ── What would be removed at a 90-day retention ─────────────────────────────
-- Change the interval to match whatever the association agrees. 90 days is a
-- reasonable default: long enough to investigate a complaint, short enough
-- that you are not keeping a face database.
SELECT COUNT(*)                                              AS to_purge,
       pg_size_pretty(SUM(octet_length(photo_data)))         AS frees_up,
       MIN(photo_captured_at)                                AS oldest_affected
FROM   visitors
WHERE  photo_data IS NOT NULL
  AND  photo_captured_at < now() - INTERVAL '90 days';


-- ── Purge ───────────────────────────────────────────────────────────────────
UPDATE visitors
SET    photo_data = NULL,
       photo_mime = NULL
       -- photo_captured_at is deliberately kept: it records that a photo was
       -- taken and later purged, which is more honest than erasing the fact.
WHERE  photo_data IS NOT NULL
  AND  photo_captured_at < now() - INTERVAL '90 days';


-- ── After ───────────────────────────────────────────────────────────────────
SELECT COUNT(*) FILTER (WHERE photo_data IS NOT NULL)          AS photos_remaining,
       pg_size_pretty(COALESCE(SUM(octet_length(photo_data)), 0)) AS total_size
FROM   visitors;

-- COMMIT;   -- or ROLLBACK;


-- ── Note on storage ─────────────────────────────────────────────────────────
-- Photos live in the visitors table as bytea. At roughly 200 KB a photo and,
-- say, 40 visitors a day, that is about 8 MB a day, or 2.4 GB a year without
-- purging. If volume grows, move the images to object storage and keep only a
-- key in the row — but that is a change to make deliberately, not by drift.
