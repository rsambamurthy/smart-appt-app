-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('MONTHLY_CHARGE', 'PENALTY_AMOUNT', 'CASH_OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "CalcMethod" AS ENUM ('FIXED_AMOUNT', 'RATE_PER_SQFT');

-- CreateTable
CREATE TABLE "fee_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID NOT NULL,
    "fee_type" "FeeType" NOT NULL,
    "calc_method" "CalcMethod",
    "amount" DECIMAL(12,2) NOT NULL,
    "due_day" SMALLINT,
    "as_on_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_configs_association_id_fee_type_is_active_idx" ON "fee_configs"("association_id", "fee_type", "is_active");

-- AddForeignKey
ALTER TABLE "fee_configs" ADD CONSTRAINT "fee_configs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_configs" ADD CONSTRAINT "fee_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
