-- Register of members.
--
-- A MEMBER IS NOT A USER. A user is a login; a member is the person holding
-- membership rights in respect of a flat. Neither implies the other — a joint
-- holder may never open the app, a tenant may hold an account and no
-- membership, and a member who sells stays on the register with a cessation
-- date, because a register that forgets former members is not a register.
--
-- Holders are therefore stored by NAME, with an optional link to a user
-- account. The link is what allows in-app voting; without it the member votes
-- in person and the committee marks them present.

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'CEASED');

CREATE TABLE "memberships" (
  "id"             UUID               NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID               NOT NULL,
  "unit_id"        UUID               NOT NULL,

  -- Sequential per association, in order of admission. Allocated by the
  -- service inside a transaction rather than by a sequence: a sequence leaves
  -- gaps on any rolled-back insert, and a register with unexplained gaps
  -- invites exactly the questions it exists to answer.
  "member_no"      INTEGER            NOT NULL,

  "admitted_on"      DATE             NOT NULL,
  "ceased_on"        DATE,
  "cessation_reason" VARCHAR(200),
  "status"           "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',

  -- Undivided share in the common property. Recorded now so share-weighted
  -- voting can be enabled later without revisiting every register.
  "share_percent"  DECIMAL(7, 4),

  "deed_reference" VARCHAR(120),
  "notes"          TEXT,

  -- The membership this one succeeded: the chain of title for a flat.
  "preceded_by_id" UUID,

  "created_at"     TIMESTAMPTZ        NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ        NOT NULL,

  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memberships_association_id_member_no_key"
  ON "memberships" ("association_id", "member_no");

CREATE INDEX "memberships_association_id_status_idx" ON "memberships" ("association_id", "status");
CREATE INDEX "memberships_unit_id_status_idx"        ON "memberships" ("unit_id", "status");

-- A flat has at most ONE active membership. Two would mean two votes, and the
-- transfer flow depends on this holding even if someone edits by hand.
CREATE UNIQUE INDEX "memberships_one_active_per_unit"
  ON "memberships" ("unit_id") WHERE "status" = 'ACTIVE';

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_preceded_by_id_fkey"
  FOREIGN KEY ("preceded_by_id") REFERENCES "memberships"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Holders ─────────────────────────────────────────────────────────────────
CREATE TABLE "membership_holders" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID         NOT NULL,

  -- Text, not a foreign key: many holders have no account and the register
  -- must still name them.
  "name"  VARCHAR(200) NOT NULL,
  "phone" VARCHAR(20),
  "email" VARCHAR(255),

  -- The linked account, when there is one. This is what permits in-app voting.
  "user_id" UUID,

  -- Exactly one holder per membership carries the vote. Joint holders are
  -- members in full, but a flat still has one vote.
  "is_primary" BOOLEAN NOT NULL DEFAULT false,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "membership_holders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "membership_holders_membership_id_idx" ON "membership_holders" ("membership_id");
CREATE INDEX "membership_holders_user_id_idx"       ON "membership_holders" ("user_id");

-- One primary holder per membership, enforced rather than assumed: the whole
-- voting rule rests on there being exactly one.
CREATE UNIQUE INDEX "membership_holders_one_primary"
  ON "membership_holders" ("membership_id") WHERE "is_primary" = true;

ALTER TABLE "membership_holders"
  ADD CONSTRAINT "membership_holders_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "memberships"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_holders"
  ADD CONSTRAINT "membership_holders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Nominees ────────────────────────────────────────────────────────────────
-- Who succeeds to the membership. Required under most apartment and society
-- acts, and a reliable source of disputes when absent.
CREATE TABLE "membership_nominees" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID         NOT NULL,
  "name"          VARCHAR(200) NOT NULL,
  "relationship"  VARCHAR(60),
  -- Where a member nominates more than one person, in stated proportions.
  "share_percent" DECIMAL(7, 4),
  "recorded_on"   DATE         NOT NULL DEFAULT CURRENT_DATE,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "membership_nominees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "membership_nominees_membership_id_idx" ON "membership_nominees" ("membership_id");

ALTER TABLE "membership_nominees"
  ADD CONSTRAINT "membership_nominees_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "memberships"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Seed from what is already known ─────────────────────────────────────────
--
-- Every flat with a registered owner gets a membership, so the register starts
-- populated rather than blank. This is a STARTING POINT, not a finished
-- register: admitted_on is the account's creation date, which is when the
-- record was made rather than when the person actually acquired the flat, and
-- nobody has joint holders or nominees yet.
--
-- Flats with no owner on file get nothing, and will show as gaps on the
-- register screen — which is the honest outcome and the prompt to fix them.
WITH owners AS (
  SELECT DISTINCT ON (u.unit_id)
         u.unit_id,
         u.association_id,
         u.id   AS user_id,
         u.name,
         u.phone,
         u.email,
         u.created_at
  FROM   users u
  JOIN   units un ON un.id = u.unit_id
  WHERE  u.is_owner = true
    AND  u.is_active = true
    AND  u.deleted_at IS NULL
    AND  un.deleted_at IS NULL
  ORDER  BY u.unit_id, u.created_at ASC
),
numbered AS (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY o.association_id ORDER BY o.created_at, o.unit_id) AS member_no
  FROM   owners o
),
inserted AS (
  INSERT INTO "memberships"
    ("association_id", "unit_id", "member_no", "admitted_on", "status", "notes", "created_at", "updated_at")
  SELECT n.association_id,
         n.unit_id,
         n.member_no,
         n.created_at::date,
         'ACTIVE'::"MembershipStatus",
         'Seeded from the owner on file when the register was introduced. Admission date is the account creation date and should be corrected to the actual date of acquisition.',
         now(), now()
  FROM   numbered n
  RETURNING "id", "unit_id"
)
INSERT INTO "membership_holders"
  ("membership_id", "name", "phone", "email", "user_id", "is_primary", "created_at", "updated_at")
SELECT i.id, n.name, n.phone, n.email, n.user_id, true, now(), now()
FROM   inserted i
JOIN   numbered n ON n.unit_id = i.unit_id;
