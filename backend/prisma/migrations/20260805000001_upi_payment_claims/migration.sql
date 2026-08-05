-- Pay by UPI, and the claims that come back from it.
--
-- A UPI deep link opens PhonePe/GPay and tells us nothing afterwards. There is
-- no callback to a WebView, and the UPI app's own response is not something to
-- trust. So the resident tells us what happened, and a treasurer checks it.
--
-- A claim is therefore NOT a payment. It lives in its own table until someone
-- confirms it against the bank, at which point a real `payments` row and its
-- journal entry are created. That separation is the whole safety property:
-- a resident cannot clear their own arrears, and the accounts never carry
-- money the bank did not receive.

-- ── Where the money goes ─────────────────────────────────────────────────────
--
-- The UPI address belongs to a bank account, not to the association: one VPA
-- credits exactly one account. The payee name lives there too, because many
-- small societies bank in a treasurer's individual name and the name a resident
-- sees in PhonePe has to match whoever actually holds the account.
ALTER TABLE "business_partners" ADD COLUMN "upi_vpa"        VARCHAR(100);
ALTER TABLE "business_partners" ADD COLUMN "upi_payee_name" VARCHAR(100);

-- Which bank account collects dues by UPI.
ALTER TABLE "dues_config" ADD COLUMN "upi_bank_bp_id" UUID;
ALTER TABLE "dues_config"
  ADD CONSTRAINT "dues_config_upi_bank_bp_id_fkey"
  FOREIGN KEY ("upi_bank_bp_id") REFERENCES "business_partners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A UPI address must be unique within an association. Two bank accounts
-- claiming the same VPA means one of them is wrong, and the money lands
-- somewhere the books do not expect.
CREATE UNIQUE INDEX "business_partners_upi_vpa_unique"
    ON "business_partners"("association_id", "upi_vpa")
    WHERE "upi_vpa" IS NOT NULL;

CREATE TYPE "PaymentClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "payment_claims" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID          NOT NULL,
    "bill_id"        UUID          NOT NULL,
    "unit_id"        UUID          NOT NULL,

    "amount"         DECIMAL(10,2) NOT NULL,
    "upi_reference"  VARCHAR(50)   NOT NULL,
    "intent_ref"     VARCHAR(50),
    "paid_on"        DATE          NOT NULL,

    "status"         "PaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimed_by"     UUID          NOT NULL,
    "claimed_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    "reviewed_by"    UUID,
    "reviewed_at"    TIMESTAMPTZ,
    "review_note"    TEXT,

    "payment_id"     UUID,

    -- @updatedAt is written by the Prisma client and has no database default,
    -- so anything inserting here by raw SQL must supply it.
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "payment_claims_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_claimed_by_fkey"
  FOREIGN KEY ("claimed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "payment_claims_payment_id_key" ON "payment_claims"("payment_id");
CREATE INDEX "payment_claims_assoc_status_idx" ON "payment_claims"("association_id", "status");
CREATE INDEX "payment_claims_bill_id_idx"       ON "payment_claims"("bill_id");
CREATE INDEX "payment_claims_unit_id_idx"       ON "payment_claims"("unit_id");

-- One live claim per bill. Without this, a resident who taps twice — or who
-- gets impatient waiting for confirmation — creates duplicates, and the
-- treasurer cannot tell a genuine second payment from a repeated one.
-- Rejected and confirmed claims are excluded, so a rejected claim can be
-- resubmitted with a corrected reference.
CREATE UNIQUE INDEX "payment_claims_one_pending_per_bill"
    ON "payment_claims"("bill_id")
    WHERE "status" = 'PENDING';

-- The same UTR must not be used twice in one association. A UPI reference
-- identifies exactly one transfer; reusing it means either a mistake or an
-- attempt to have one payment settle two bills.
CREATE UNIQUE INDEX "payment_claims_utr_unique"
    ON "payment_claims"("association_id", "upi_reference")
    WHERE "status" <> 'REJECTED';

ALTER TABLE "payment_claims"
  ADD CONSTRAINT "payment_claims_amount_positive" CHECK ("amount" > 0);

-- A review must carry its author, and a rejection must carry its reason.
ALTER TABLE "payment_claims"
  ADD CONSTRAINT "payment_claims_review_complete"
  CHECK (
    ("status" = 'PENDING' AND "reviewed_at" IS NULL AND "reviewed_by" IS NULL)
    OR
    ("status" = 'CONFIRMED' AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL)
    OR
    ("status" = 'REJECTED'  AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL
     AND "review_note" IS NOT NULL AND length(btrim("review_note")) > 0)
  );
