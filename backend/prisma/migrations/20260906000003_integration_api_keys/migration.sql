-- Scoped API keys for outside services (the BPM/workflow tool being built
-- alongside this) to call specific SmartAppt actions on an association's
-- behalf, without a shared human login. A key grants only the exact action
-- scopes it was created with (see application code's requireApiKeyScope) —
-- never a role, never broader read access.
--
-- Only the SHA-256 hash of the secret is ever stored (key_hash); the
-- plaintext is generated once at creation time, shown to the Manager exactly
-- once, and is unrecoverable after that — same posture as every other
-- generated-secret pattern (e.g. OAuth client secrets), so a compromised
-- database dump alone can never be used to authenticate as a key.
CREATE TABLE "integration_api_keys" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID          NOT NULL,
    "name"           VARCHAR(120)  NOT NULL,
    "key_prefix"     VARCHAR(16)   NOT NULL,
    "key_hash"       VARCHAR(64)   NOT NULL,
    "scopes"         VARCHAR(60)[] NOT NULL,
    "is_active"      BOOLEAN       NOT NULL DEFAULT true,
    "last_used_at"   TIMESTAMPTZ,
    "created_by_id"  UUID,
    "revoked_at"     TIMESTAMPTZ,
    "revoked_by_id"  UUID,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ   NOT NULL,

    CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_api_keys_key_hash_key" ON "integration_api_keys"("key_hash");
CREATE INDEX "integration_api_keys_association_id_idx" ON "integration_api_keys"("association_id");

ALTER TABLE "integration_api_keys"
  ADD CONSTRAINT "integration_api_keys_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_api_keys"
  ADD CONSTRAINT "integration_api_keys_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integration_api_keys"
  ADD CONSTRAINT "integration_api_keys_revoked_by_id_fkey"
  FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
