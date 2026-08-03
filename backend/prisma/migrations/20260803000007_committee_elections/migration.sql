-- Committee elections.
--
-- General seats, top N win. A nomination needs a proposer and a seconder.
-- Declaring the result replaces the committee roster.
--
-- SECRECY IS STRUCTURAL, unlike resolution voting. The choices sit on an
-- anonymous ballot paper; a separate voter roll records only that a flat has
-- voted. No column links the two. A resolution can legitimately be an open
-- vote; an election should not be, so the schema refuses to hold the link at
-- all rather than relying on the API to withhold it.
--
-- The residual leak, stated plainly: both rows are written in one transaction,
-- so anyone with database access could correlate ballots to voters by
-- timestamp when few people are voting at once. That is far weaker than
-- storing the association outright, but it is not nothing.

CREATE TYPE "ElectionStatus" AS ENUM (
  'DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED',
  'VOTING_OPEN', 'VOTING_CLOSED', 'DECLARED', 'CANCELLED'
);

CREATE TYPE "NominationStatus" AS ENUM (
  'PROPOSED', 'SECONDED', 'ACCEPTED', 'WITHDRAWN', 'REJECTED'
);


CREATE TABLE "elections" (
  "id"             UUID             NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID             NOT NULL,
  "committee_id"   UUID             NOT NULL,

  "title"  VARCHAR(200)     NOT NULL,
  "seats"  SMALLINT         NOT NULL,
  "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',

  "term_starts_on" DATE NOT NULL,
  "term_ends_on"   DATE NOT NULL,

  "nominations_close_at" TIMESTAMPTZ,
  "voting_closes_at"     TIMESTAMPTZ,

  "declared_at"    TIMESTAMPTZ,
  "declared_by_id" UUID,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "elections_pkey" PRIMARY KEY ("id"),
  -- A term that ends before it starts is a typo, not a policy.
  CONSTRAINT "elections_term_order" CHECK ("term_ends_on" > "term_starts_on"),
  CONSTRAINT "elections_seats_positive" CHECK ("seats" > 0)
);

CREATE INDEX "elections_association_id_status_idx" ON "elections" ("association_id", "status");

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_committee_id_fkey"
  FOREIGN KEY ("committee_id") REFERENCES "committees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_declared_by_id_fkey"
  FOREIGN KEY ("declared_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Candidates ──────────────────────────────────────────────────────────────
CREATE TABLE "election_candidates" (
  "id"          UUID               NOT NULL DEFAULT gen_random_uuid(),
  "election_id" UUID               NOT NULL,
  "user_id"     UUID               NOT NULL,

  -- Their flat, captured at nomination so the ballot still reads correctly if
  -- they move or transfer the property mid-election.
  "unit_id"     UUID               NOT NULL,

  "status"      "NominationStatus" NOT NULL DEFAULT 'PROPOSED',
  "statement"   TEXT,

  -- Two other members must back a nomination before it stands. Held as flats,
  -- because backing is an act of the membership, and one vote per flat.
  "proposed_by_unit_id" UUID,
  "seconded_by_unit_id" UUID,
  "seconded_at"         TIMESTAMPTZ,
  "accepted_at"         TIMESTAMPTZ,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "election_candidates_pkey" PRIMARY KEY ("id")
);

-- One nomination per person per election.
CREATE UNIQUE INDEX "election_candidates_election_id_user_id_key"
  ON "election_candidates" ("election_id", "user_id");

CREATE INDEX "election_candidates_election_id_status_idx"
  ON "election_candidates" ("election_id", "status");

ALTER TABLE "election_candidates"
  ADD CONSTRAINT "election_candidates_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_candidates"
  ADD CONSTRAINT "election_candidates_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_candidates"
  ADD CONSTRAINT "election_candidates_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id")
  ON UPDATE CASCADE;


-- ── The ballot paper — anonymous by construction ────────────────────────────
CREATE TABLE "election_ballots" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "election_id" UUID        NOT NULL,
  "cast_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "election_ballots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "election_ballots_election_id_idx" ON "election_ballots" ("election_id");

ALTER TABLE "election_ballots"
  ADD CONSTRAINT "election_ballots_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "election_ballot_choices" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "ballot_id"    UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  CONSTRAINT "election_ballot_choices_pkey" PRIMARY KEY ("id")
);

-- A ballot cannot name the same candidate twice.
CREATE UNIQUE INDEX "election_ballot_choices_ballot_id_candidate_id_key"
  ON "election_ballot_choices" ("ballot_id", "candidate_id");

CREATE INDEX "election_ballot_choices_candidate_id_idx"
  ON "election_ballot_choices" ("candidate_id");

ALTER TABLE "election_ballot_choices"
  ADD CONSTRAINT "election_ballot_choices_ballot_id_fkey"
  FOREIGN KEY ("ballot_id") REFERENCES "election_ballots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_ballot_choices"
  ADD CONSTRAINT "election_ballot_choices_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "election_candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- ── The voter roll — who voted, and nothing about how ───────────────────────
CREATE TABLE "election_voter_roll" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "election_id" UUID        NOT NULL,
  "unit_id"     UUID        NOT NULL,
  "voted_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "election_voter_roll_pkey" PRIMARY KEY ("id")
);

-- One vote per flat, enforced here rather than on the ballot, because the
-- ballot deliberately does not know whose it is.
CREATE UNIQUE INDEX "election_voter_roll_election_id_unit_id_key"
  ON "election_voter_roll" ("election_id", "unit_id");

ALTER TABLE "election_voter_roll"
  ADD CONSTRAINT "election_voter_roll_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_voter_roll"
  ADD CONSTRAINT "election_voter_roll_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
