-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('FIXED', 'RATE_PER_SQFT');

-- AlterTable
ALTER TABLE "dues_config" ADD COLUMN     "charge_type" "ChargeType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "rate_per_sqft" DECIMAL(10,4);
