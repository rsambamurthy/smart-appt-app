-- Add auto-generate bill scheduling fields to dues_config
ALTER TABLE dues_config ADD COLUMN IF NOT EXISTS auto_generate_bills BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dues_config ADD COLUMN IF NOT EXISTS auto_generate_day SMALLINT NOT NULL DEFAULT 1;
