-- Change closing_entry_id from UUID to VARCHAR(30) so we can store reference_codes like "JV-2025-26-0012"
ALTER TABLE "financial_year_closes"
  ALTER COLUMN "closing_entry_id" TYPE VARCHAR(30) USING "closing_entry_id"::TEXT;
