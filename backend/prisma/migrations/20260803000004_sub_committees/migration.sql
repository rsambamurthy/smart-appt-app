-- Sub-committees: finance, water and sewerage, maintenance, and so on.
--
-- A sub-committee meeting follows a DIFFERENT rule from a general body
-- meeting. Quorum counts members, and each member votes as an individual —
-- not one vote per flat. Two members living in the same flat get a vote each,
-- which is the point of appointing people rather than households.
--
-- Both rules coexist in the same tables. unit_id becomes nullable: set for a
-- general body vote, NULL for a committee vote. Postgres treats NULLs as
-- DISTINCT in a unique index, so the existing (agenda_item_id, unit_id)
-- constraint simply stops applying to committee rows rather than colliding
-- them all together, and a second constraint on user_id takes over.

CREATE TABLE "committees" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID         NOT NULL,
  "name"           VARCHAR(120) NOT NULL,
  "description"    TEXT,
  "is_active"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "committees_association_id_name_key"
  ON "committees" ("association_id", "name");

ALTER TABLE "committees"
  ADD CONSTRAINT "committees_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "committee_members" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "committee_id" UUID        NOT NULL,
  "user_id"      UUID        NOT NULL,
  "is_convenor"  BOOLEAN     NOT NULL DEFAULT false,
  "appointed_on" DATE        NOT NULL DEFAULT CURRENT_DATE,
  -- Set when someone steps down. Past members are kept so historic quorum and
  -- vote records still make sense: a meeting held last year was quorate
  -- against the committee as it stood then.
  "ended_on"     DATE,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL,
  CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "committee_members_committee_id_user_id_key"
  ON "committee_members" ("committee_id", "user_id");

CREATE INDEX "committee_members_committee_id_ended_on_idx"
  ON "committee_members" ("committee_id", "ended_on");

ALTER TABLE "committee_members"
  ADD CONSTRAINT "committee_members_committee_id_fkey"
  FOREIGN KEY ("committee_id") REFERENCES "committees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "committee_members"
  ADD CONSTRAINT "committee_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Meetings belong to a committee, or to the general body ──────────────────
-- NULL means the whole association: an AGM or EGM, one vote per flat.
ALTER TABLE "meetings" ADD COLUMN "committee_id" UUID;

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_committee_id_fkey"
  FOREIGN KEY ("committee_id") REFERENCES "committees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "meetings_committee_id_idx" ON "meetings" ("committee_id");


-- ── Attendance: per flat, or per member ─────────────────────────────────────
ALTER TABLE "meeting_attendees" ALTER COLUMN "unit_id" DROP NOT NULL;

-- Committee attendance is one row per member.
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_user_id_key"
  ON "meeting_attendees" ("meeting_id", "user_id");


-- ── Votes: per flat, or per member ──────────────────────────────────────────
ALTER TABLE "resolution_votes" ALTER COLUMN "unit_id" DROP NOT NULL;

-- One vote per person. Enforces the committee rule, and is harmlessly true of
-- general body votes too, since each flat's vote is attributed to one caster.
CREATE UNIQUE INDEX "resolution_votes_agenda_item_id_user_id_key"
  ON "resolution_votes" ("agenda_item_id", "user_id");


-- ── The built-in managing committee ─────────────────────────────────────────
-- Its roster is NOT stored in committee_members. It is every active user with
-- role = COMMITTEE, resolved when read. Materialising it would mean keeping
-- two sources of truth in step every time someone's role changed, and they
-- would drift the first time anyone edited a user outside this module.
ALTER TABLE "committees" ADD COLUMN "is_managing" BOOLEAN NOT NULL DEFAULT false;

-- One per association, created up front so it can be picked from a dropdown
-- on day one rather than appearing only after someone thinks to add it.
INSERT INTO "committees" ("association_id", "name", "description", "is_managing", "created_at", "updated_at")
SELECT id,
       'Managing committee',
       'The elected managing committee. Members are everyone with the Committee role.',
       true,
       now(), now()
FROM   "associations"
ON CONFLICT ("association_id", "name") DO NOTHING;
