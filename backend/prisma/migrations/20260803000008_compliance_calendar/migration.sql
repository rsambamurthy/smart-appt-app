-- Compliance calendar: statutory obligations with dates.
--
-- An item recurs; each due date is an occurrence marked done separately, so
-- last year's filing stays on the record with its acknowledgement number.

CREATE TYPE "ComplianceCategory" AS ENUM
  ('MEETING', 'AUDIT', 'FILING', 'TAX', 'INSURANCE', 'LICENCE', 'OTHER');

CREATE TYPE "Recurrence" AS ENUM
  ('NONE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL');

CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'DONE', 'WAIVED');


CREATE TABLE "compliance_items" (
  "id"             UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID                 NOT NULL,
  "title"          VARCHAR(200)         NOT NULL,
  "description"    TEXT,
  "category"       "ComplianceCategory" NOT NULL DEFAULT 'OTHER',
  "recurrence"     "Recurrence"         NOT NULL DEFAULT 'ANNUAL',

  -- Anchor for the due date. due_month is 1–12, used by annual, half yearly
  -- and quarterly items; monthly items use only due_day.
  "due_month" SMALLINT,
  "due_day"   SMALLINT NOT NULL DEFAULT 1,

  -- Null means nobody has taken it on, which is worth seeing rather than
  -- hiding behind a default.
  "owner_user_id" UUID,

  "remind_days_before" SMALLINT NOT NULL DEFAULT 14,
  "is_active"          BOOLEAN  NOT NULL DEFAULT true,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compliance_items_due_day"   CHECK ("due_day"   BETWEEN 1 AND 31),
  CONSTRAINT "compliance_items_due_month" CHECK ("due_month" IS NULL OR "due_month" BETWEEN 1 AND 12)
);

CREATE INDEX "compliance_items_association_id_is_active_idx"
  ON "compliance_items" ("association_id", "is_active");

ALTER TABLE "compliance_items"
  ADD CONSTRAINT "compliance_items_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_items"
  ADD CONSTRAINT "compliance_items_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "compliance_occurrences" (
  "id"      UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id" UUID NOT NULL,

  -- Denormalised so "what is overdue for this association" is one query
  -- rather than a join through items on every dashboard load.
  "association_id" UUID NOT NULL,

  "due_on" DATE               NOT NULL,
  "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',

  "completed_on"    DATE,
  "completed_by_id" UUID,
  "reference"       VARCHAR(160),
  "notes"           TEXT,

  -- Set when the owner has been told, so the scheduler does not tell them
  -- again on every run.
  "reminded_at"  TIMESTAMPTZ,
  "escalated_at" TIMESTAMPTZ,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "compliance_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compliance_occurrences_item_id_due_on_key"
  ON "compliance_occurrences" ("item_id", "due_on");

CREATE INDEX "compliance_occurrences_association_id_status_due_on_idx"
  ON "compliance_occurrences" ("association_id", "status", "due_on");

ALTER TABLE "compliance_occurrences"
  ADD CONSTRAINT "compliance_occurrences_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "compliance_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_occurrences"
  ADD CONSTRAINT "compliance_occurrences_completed_by_id_fkey"
  FOREIGN KEY ("completed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Starter list ────────────────────────────────────────────────────────────
--
-- Common obligations for an Indian apartment association, as a starting point.
-- Every association should check these against its own bye-laws and state —
-- notice periods, filing deadlines and which certificates apply all vary, and
-- this list is a prompt to think rather than a statement of the law. Each item
-- is editable and deletable.
--
-- Dates are deliberately conservative defaults, not deadlines to rely on.
INSERT INTO "compliance_items"
  ("association_id", "title", "description", "category", "recurrence",
   "due_month", "due_day", "remind_days_before", "created_at", "updated_at")
SELECT a.id, x.title, x.description, x.category::"ComplianceCategory",
       x.recurrence::"Recurrence", x.due_month, x.due_day, x.remind, now(), now()
FROM   "associations" a
CROSS  JOIN (VALUES
  ('Annual general meeting',
   'Hold the AGM within the period your bye-laws require after the financial year ends. Check your own bye-laws for the exact window and notice period.',
   'MEETING', 'ANNUAL', 9, 30, 30),
  ('Annual accounts audited',
   'Accounts for the year audited and signed off before presentation to the general body.',
   'AUDIT', 'ANNUAL', 8, 31, 30),
  ('Appoint or reappoint the auditor',
   'Usually a resolution at the AGM. Record the appointment in the minutes.',
   'AUDIT', 'ANNUAL', 9, 30, 21),
  ('Income tax return',
   'Confirm the filing deadline that applies to your association for the assessment year.',
   'TAX', 'ANNUAL', 7, 31, 30),
  ('Building and public liability insurance renewal',
   'Renew before expiry. Keep the policy document with the association records.',
   'INSURANCE', 'ANNUAL', 3, 31, 30),
  ('Lift licence and inspection',
   'Statutory inspection and licence renewal where lifts are installed. Frequency varies by state.',
   'LICENCE', 'ANNUAL', 6, 30, 30),
  ('Fire safety certificate',
   'Renewal of the fire NOC or safety certificate, where one applies to the building.',
   'LICENCE', 'ANNUAL', 6, 30, 30)
) AS x(title, description, category, recurrence, due_month, due_day, remind);
