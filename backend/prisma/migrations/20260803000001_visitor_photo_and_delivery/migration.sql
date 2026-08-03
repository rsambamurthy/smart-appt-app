-- Gate photo capture and the delivery flow.
-- All columns nullable, so existing visitor rows are unaffected.

-- Parcel lifecycle. Deliberately separate from VisitorStatus: the courier can
-- leave while the parcel stays at the gate.
CREATE TYPE "DeliveryStatus" AS ENUM ('AT_GATE', 'SENT_UP', 'COLLECTED', 'RETURNED');

ALTER TABLE "visitors"
  ADD COLUMN "photo_data"        BYTEA,
  ADD COLUMN "photo_mime"        VARCHAR(100),
  ADD COLUMN "photo_captured_at" TIMESTAMPTZ,
  ADD COLUMN "delivery_status"   "DeliveryStatus",
  ADD COLUMN "delivery_provider" VARCHAR(60),
  ADD COLUMN "collected_at"      TIMESTAMPTZ;

-- The gate board asks "which parcels are still here" on every poll.
CREATE INDEX "visitors_association_id_delivery_status_idx"
  ON "visitors" ("association_id", "delivery_status");
