-- CreateTable: service_types (Vendor Service Type master)
CREATE TABLE "service_types" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID NOT NULL,
    "name"           VARCHAR(100) NOT NULL,
    "description"    VARCHAR(255),
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex: one name per association
CREATE UNIQUE INDEX "service_types_association_id_name_key"
    ON "service_types"("association_id", "name");

-- Index: list by association
CREATE INDEX "service_types_association_id_idx"
    ON "service_types"("association_id");

-- FK: service_types → associations
ALTER TABLE "service_types"
    ADD CONSTRAINT "service_types_association_id_fkey"
    FOREIGN KEY ("association_id")
    REFERENCES "associations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: service_type_id on business_partners
ALTER TABLE "business_partners"
    ADD COLUMN "service_type_id" UUID;

-- FK: business_partners.service_type_id → service_types
ALTER TABLE "business_partners"
    ADD CONSTRAINT "business_partners_service_type_id_fkey"
    FOREIGN KEY ("service_type_id")
    REFERENCES "service_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
