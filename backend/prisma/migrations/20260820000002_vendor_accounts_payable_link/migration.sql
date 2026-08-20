-- AddColumn: lazy link from a vendor to its Accounts Payable sub-ledger card
-- (business_partners row, bp_category = 'VENDOR'). Nullable and created on
-- first use by ensureVendorBP — most vendors never need one.
ALTER TABLE "vendors"
    ADD COLUMN "business_partner_id" UUID;

-- UniqueIndex: a vendor has at most one ledger card
CREATE UNIQUE INDEX "vendors_business_partner_id_key"
    ON "vendors"("business_partner_id");

-- FK: vendors.business_partner_id → business_partners
ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_business_partner_id_fkey"
    FOREIGN KEY ("business_partner_id")
    REFERENCES "business_partners"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
