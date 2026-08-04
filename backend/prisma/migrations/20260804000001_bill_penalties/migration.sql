-- Late-payment penalties: history, not just a number on the bill.
--
-- `bills.penalty` stays as the denormalised live total so every existing
-- query keeps working. This table records how that total was arrived at and
-- what happened to it afterwards.

CREATE TABLE "bill_penalties" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID         NOT NULL,
    "bill_id"        UUID         NOT NULL,

    "amount"         DECIMAL(10,2) NOT NULL,
    "penalty_type"   "PenaltyType" NOT NULL,
    "penalty_value"  DECIMAL(10,2) NOT NULL,
    "grace_days"     SMALLINT      NOT NULL,
    "days_overdue"   SMALLINT      NOT NULL,

    "charged_on"     DATE          NOT NULL,
    "charged_by"     UUID          NOT NULL,

    "waived_at"      TIMESTAMPTZ,
    "waived_by"      UUID,
    "waive_reason"   TEXT,

    -- @updatedAt has no database default in Prisma, so anything inserting
    -- into this table by raw SQL must supply it.
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "bill_penalties_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bill_penalties"
  ADD CONSTRAINT "bill_penalties_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bill_penalties"
  ADD CONSTRAINT "bill_penalties_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bill_penalties"
  ADD CONSTRAINT "bill_penalties_charged_by_fkey"
  FOREIGN KEY ("charged_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bill_penalties"
  ADD CONSTRAINT "bill_penalties_waived_by_fkey"
  FOREIGN KEY ("waived_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bill_penalties_bill_id_idx"  ON "bill_penalties"("bill_id");
CREATE INDEX "bill_penalties_charged_idx"  ON "bill_penalties"("association_id", "charged_on");

-- "Once per bill" as an invariant, not a convention. Two treasurers clicking
-- Apply at the same moment cannot both succeed; the second hits this index.
-- Waived rows are excluded, so a waived penalty can be re-charged later if the
-- committee changes its mind.
CREATE UNIQUE INDEX "bill_penalties_one_live_per_bill"
    ON "bill_penalties"("bill_id")
    WHERE "waived_at" IS NULL;

-- A waiver must carry its reason and its author together. Enforced here as
-- well as in the service: a half-written waiver is worse than none, because it
-- looks like a decision was recorded when it was not.
ALTER TABLE "bill_penalties"
  ADD CONSTRAINT "bill_penalties_waiver_complete"
  CHECK (
    ("waived_at" IS NULL AND "waived_by" IS NULL AND "waive_reason" IS NULL)
    OR
    ("waived_at" IS NOT NULL AND "waived_by" IS NOT NULL
     AND "waive_reason" IS NOT NULL AND length(btrim("waive_reason")) > 0)
  );

-- A penalty is a positive charge. Zero would post an empty journal entry.
ALTER TABLE "bill_penalties"
  ADD CONSTRAINT "bill_penalties_amount_positive" CHECK ("amount" > 0);
