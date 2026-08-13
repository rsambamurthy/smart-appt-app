-- The language the assistant listens and speaks in, per association.
--
-- A default rather than a rule: it sets what a resident gets before they
-- express a preference. Their own choice is kept on their device and never
-- reaches this table, because which language someone speaks at home is not
-- something the committee needs a record of.
--
-- VARCHAR(10) holds a BCP-47 tag — "en-IN", "ta-IN", "hi-IN".

ALTER TABLE "association_config"
  ADD COLUMN IF NOT EXISTS "assistant_voice_language" VARCHAR(10) NOT NULL DEFAULT 'en-IN';
