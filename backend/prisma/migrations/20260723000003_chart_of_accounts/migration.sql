-- Create AccountType enum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');

-- Create accounts table
CREATE TABLE "accounts" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "association_id" UUID        NOT NULL,
  "code"           VARCHAR(20) NOT NULL,
  "name"           VARCHAR(120) NOT NULL,
  "type"           "AccountType" NOT NULL,
  "sub_type"       VARCHAR(60),
  "description"    VARCHAR(255),
  "is_system"      BOOLEAN     NOT NULL DEFAULT false,
  "is_active"      BOOLEAN     NOT NULL DEFAULT true,
  "sort_order"     SMALLINT    NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_association_id_code_key" UNIQUE ("association_id", "code"),
  CONSTRAINT "accounts_association_id_fkey" FOREIGN KEY ("association_id")
    REFERENCES "associations"("id") ON DELETE CASCADE
);
