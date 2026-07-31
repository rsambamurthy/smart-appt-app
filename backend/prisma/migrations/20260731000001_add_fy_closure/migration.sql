-- FinancialYearClose table
CREATE TABLE "financial_year_closes" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id"   UUID NOT NULL,
    "financial_year"   VARCHAR(7) NOT NULL,
    "status"           VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    "net_surplus"      DECIMAL(15,2) NOT NULL,
    "closing_entry_id" UUID,
    "notes"            TEXT,
    "closed_by_id"     UUID,
    "closed_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "reopened_by_id"   UUID,
    "reopened_at"      TIMESTAMPTZ,

    CONSTRAINT "financial_year_closes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "financial_year_closes"
    ADD CONSTRAINT "financial_year_closes_association_id_fkey"
    FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE;

ALTER TABLE "financial_year_closes"
    ADD CONSTRAINT "financial_year_closes_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "financial_year_closes"
    ADD CONSTRAINT "financial_year_closes_reopened_by_id_fkey"
    FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "financial_year_closes_association_id_financial_year_key"
    ON "financial_year_closes"("association_id", "financial_year");
