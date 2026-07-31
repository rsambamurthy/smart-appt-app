-- AddColumn: accounting feature flags to mobile_config
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "feature_journal"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "feature_ledger"        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "feature_pnl"           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "feature_balance_sheet" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "feature_coa"           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "feature_fy_closure"    BOOLEAN NOT NULL DEFAULT true;
