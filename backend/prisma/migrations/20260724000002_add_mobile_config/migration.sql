-- CreateTable
CREATE TABLE "mobile_config" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "association_id"        UUID        NOT NULL,
  "feature_bills"         BOOLEAN     NOT NULL DEFAULT true,
  "feature_announcements" BOOLEAN     NOT NULL DEFAULT true,
  "feature_complaints"    BOOLEAN     NOT NULL DEFAULT true,
  "feature_visitors"      BOOLEAN     NOT NULL DEFAULT true,
  "push_dues_reminder"    BOOLEAN     NOT NULL DEFAULT true,
  "push_announcements"    BOOLEAN     NOT NULL DEFAULT true,
  "push_visitor_alerts"   BOOLEAN     NOT NULL DEFAULT true,
  "login_mpin_enabled"    BOOLEAN     NOT NULL DEFAULT true,
  "login_biometric"       BOOLEAN     NOT NULL DEFAULT false,
  "login_otp_only"        BOOLEAN     NOT NULL DEFAULT false,
  "app_name"              VARCHAR(100),
  "theme_color"           VARCHAR(7),
  "logo_url"              TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "mobile_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_config_association_id_key" ON "mobile_config"("association_id");

-- AddForeignKey
ALTER TABLE "mobile_config" ADD CONSTRAINT "mobile_config_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
