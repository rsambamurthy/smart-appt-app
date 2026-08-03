-- Governance: meetings, agendas, resolutions and minutes.
--
-- Voting is one vote per FLAT rather than per person — two owners of the same
-- unit share a single vote, which is how apartment associations almost always
-- work. That is enforced by unique constraints on unit_id below, not by
-- application logic, because application logic gets forgotten.

CREATE TYPE "MeetingType"       AS ENUM ('AGM', 'EGM', 'COMMITTEE');
CREATE TYPE "MeetingStatus"     AS ENUM ('DRAFT', 'NOTICE_ISSUED', 'IN_PROGRESS', 'CONCLUDED', 'CANCELLED');
CREATE TYPE "RsvpStatus"        AS ENUM ('YES', 'NO', 'MAYBE');
CREATE TYPE "ResolutionStatus"  AS ENUM ('NOT_OPEN', 'OPEN', 'CLOSED');
CREATE TYPE "ResolutionOutcome" AS ENUM ('CARRIED', 'DEFEATED', 'WITHDRAWN');
CREATE TYPE "VoteChoice"        AS ENUM ('FOR', 'AGAINST', 'ABSTAIN');


-- ── Per-association rules ───────────────────────────────────────────────────
-- No jurisdiction is assumed. Notice periods and quorum differ by state and by
-- an association's own bye-laws, so every figure is configurable. The defaults
-- are common values, not legal advice.
CREATE TABLE "governance_config" (
  "id"                       UUID          NOT NULL DEFAULT gen_random_uuid(),
  "association_id"           UUID          NOT NULL,
  "notice_days"              SMALLINT      NOT NULL DEFAULT 21,
  "quorum_percent"           DECIMAL(5, 2) NOT NULL DEFAULT 33.33,
  "adjourned_quorum_percent" DECIMAL(5, 2),
  "voting_window_hours"      SMALLINT      NOT NULL DEFAULT 24,
  "created_at"               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ   NOT NULL,
  CONSTRAINT "governance_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "governance_config_association_id_key"
  ON "governance_config" ("association_id");

ALTER TABLE "governance_config"
  ADD CONSTRAINT "governance_config_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Meetings ────────────────────────────────────────────────────────────────
CREATE TABLE "meetings" (
  "id"             UUID            NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID            NOT NULL,
  "title"          VARCHAR(200)    NOT NULL,
  "meeting_type"   "MeetingType"   NOT NULL,
  "status"         "MeetingStatus" NOT NULL DEFAULT 'DRAFT',

  "scheduled_at"   TIMESTAMPTZ     NOT NULL,
  "venue"          VARCHAR(300),
  "online_link"    VARCHAR(500),

  "notice_body"      TEXT,
  "notice_issued_at" TIMESTAMPTZ,

  -- Snapshotted when notice is issued, NOT read live from governance_config.
  -- A meeting's validity is judged by the rules in force when it was called;
  -- changing the quorum setting next year must not retroactively invalidate a
  -- meeting held under the old one.
  "quorum_percent" DECIMAL(5, 2),
  "eligible_units" SMALLINT,

  "concluded_at"         TIMESTAMPTZ,
  "minutes_body"         TEXT,
  "minutes_published_at" TIMESTAMPTZ,

  "created_by_id" UUID,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL,

  CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meetings_association_id_scheduled_at_idx" ON "meetings" ("association_id", "scheduled_at");
CREATE INDEX "meetings_association_id_status_idx"       ON "meetings" ("association_id", "status");

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the meeting if the organiser's account is later removed.
ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Agenda ──────────────────────────────────────────────────────────────────
CREATE TABLE "agenda_items" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "meeting_id"  UUID         NOT NULL,
  "seq"         SMALLINT     NOT NULL,
  "title"       VARCHAR(300) NOT NULL,
  "description" TEXT,

  -- Discussion items are minuted but never voted on.
  "is_resolution" BOOLEAN            NOT NULL DEFAULT false,
  "voting_status" "ResolutionStatus" NOT NULL DEFAULT 'NOT_OPEN',

  -- A secret ballot hides attribution from the committee: only tallies are
  -- returned. The row still records which flat voted, because that is what
  -- prevents double-voting — so this is enforced discretion at the API, not
  -- cryptographic secrecy. Anyone with database access can still see it.
  "is_secret" BOOLEAN NOT NULL DEFAULT false,

  -- Share of votes cast (abstentions excluded) needed to carry. Ordinary
  -- resolutions take a simple majority; bye-law amendments and similar often
  -- need three quarters, so this is per item rather than per association.
  "pass_threshold_percent" DECIMAL(5, 2) NOT NULL DEFAULT 50.00,

  "voting_opened_at" TIMESTAMPTZ,
  "voting_closed_at" TIMESTAMPTZ,
  "outcome"          "ResolutionOutcome",

  CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agenda_items_meeting_id_seq_key" ON "agenda_items" ("meeting_id", "seq");

ALTER TABLE "agenda_items"
  ADD CONSTRAINT "agenda_items_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Attendance ──────────────────────────────────────────────────────────────
CREATE TABLE "meeting_attendees" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "meeting_id" UUID         NOT NULL,
  "unit_id"    UUID         NOT NULL,
  "user_id"    UUID,
  "rsvp"       "RsvpStatus",
  "attended"   BOOLEAN      NOT NULL DEFAULT false,
  "marked_at"  TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- One record per flat: quorum counts flats, not heads.
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_unit_id_key"
  ON "meeting_attendees" ("meeting_id", "unit_id");

ALTER TABLE "meeting_attendees"
  ADD CONSTRAINT "meeting_attendees_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meeting_attendees"
  ADD CONSTRAINT "meeting_attendees_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meeting_attendees"
  ADD CONSTRAINT "meeting_attendees_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Votes ───────────────────────────────────────────────────────────────────
CREATE TABLE "resolution_votes" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agenda_item_id" UUID         NOT NULL,
  "unit_id"        UUID         NOT NULL,
  "user_id"        UUID         NOT NULL,
  "choice"         "VoteChoice" NOT NULL,
  "cast_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "resolution_votes_pkey" PRIMARY KEY ("id")
);

-- One vote per flat, enforced by the database. Two owners of the same unit
-- cannot vote twice; a second attempt updates the existing row.
CREATE UNIQUE INDEX "resolution_votes_agenda_item_id_unit_id_key"
  ON "resolution_votes" ("agenda_item_id", "unit_id");

ALTER TABLE "resolution_votes"
  ADD CONSTRAINT "resolution_votes_agenda_item_id_fkey"
  FOREIGN KEY ("agenda_item_id") REFERENCES "agenda_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resolution_votes"
  ADD CONSTRAINT "resolution_votes_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Votes are a permanent record, so the caster cannot be removed out from
-- under one. Deactivate the user instead.
ALTER TABLE "resolution_votes"
  ADD CONSTRAINT "resolution_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Seed config for existing associations ───────────────────────────────────
-- Defaults only; each association edits its own from the governance settings
-- screen. updated_at has no database default because Prisma's @updatedAt is
-- applied client-side, so a raw INSERT must supply it.
INSERT INTO "governance_config" ("association_id", "created_at", "updated_at")
SELECT id, now(), now() FROM "associations"
ON CONFLICT ("association_id") DO NOTHING;
