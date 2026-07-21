-- CreateTable
CREATE TABLE "menu_group_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" VARCHAR(50) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "menu_group_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_group_config_group_id_role_key" ON "menu_group_config"("group_id", "role");
