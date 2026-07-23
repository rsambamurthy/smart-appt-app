-- Migration: Add other_receipts table + target_unit_ids to one_time_dues

-- 1. Add target_unit_ids to one_time_dues (empty array = all units)
ALTER TABLE one_time_dues
  ADD COLUMN IF NOT EXISTS target_unit_ids TEXT[] NOT NULL DEFAULT '{}';

-- 2. Create other_receipts table
CREATE TABLE IF NOT EXISTS other_receipts (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  association_id UUID        NOT NULL,
  receipt_date   DATE        NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  category       VARCHAR(100) NOT NULL,
  description    TEXT,
  received_from  VARCHAR(255),
  payment_mode   "PaymentMode" NOT NULL,
  recorded_by    UUID        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,

  CONSTRAINT other_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT other_receipts_association_fkey FOREIGN KEY (association_id) REFERENCES associations(id),
  CONSTRAINT other_receipts_recorder_fkey   FOREIGN KEY (recorded_by)    REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS other_receipts_association_idx ON other_receipts(association_id);
CREATE INDEX IF NOT EXISTS other_receipts_date_idx        ON other_receipts(receipt_date);
