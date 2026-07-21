-- AlterTable
ALTER TABLE "dues_config" ADD COLUMN     "cash_balance" DECIMAL(12,2),
ADD COLUMN     "cash_balance_as_on" DATE;

-- AlterTable
ALTER TABLE "one_time_dues" ALTER COLUMN "updated_at" DROP DEFAULT;
