/*
  Warnings:

  - Changed the type of `category` on the `expense_budgets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category` on the `expenses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category` on the `recurring_expenses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "expense_budgets" DROP COLUMN "category",
ADD COLUMN     "category" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "category",
ADD COLUMN     "category" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "recurring_expenses" DROP COLUMN "category",
ADD COLUMN     "category" VARCHAR(100) NOT NULL;

-- DropEnum
DROP TYPE "ExpenseCategory";

-- CreateTable
CREATE TABLE "expense_category_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_category_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_category_configs_association_id_is_active_idx" ON "expense_category_configs"("association_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "expense_category_configs_association_id_name_key" ON "expense_category_configs"("association_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_budgets_association_id_category_financial_year_key" ON "expense_budgets"("association_id", "category", "financial_year");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- AddForeignKey
ALTER TABLE "expense_category_configs" ADD CONSTRAINT "expense_category_configs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
