@echo off
echo ============================================================
echo  Pushing: Mobile App System Settings
echo ============================================================
echo.
echo  SQL TO RUN ON RAILWAY BEFORE DEPLOYING:
echo  ------------------------------------------
echo  CREATE TABLE "mobile_config" (
echo    "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
echo    "association_id"        UUID        NOT NULL,
echo    "feature_bills"         BOOLEAN     NOT NULL DEFAULT true,
echo    "feature_announcements" BOOLEAN     NOT NULL DEFAULT true,
echo    "feature_complaints"    BOOLEAN     NOT NULL DEFAULT true,
echo    "feature_visitors"      BOOLEAN     NOT NULL DEFAULT true,
echo    "push_dues_reminder"    BOOLEAN     NOT NULL DEFAULT true,
echo    "push_announcements"    BOOLEAN     NOT NULL DEFAULT true,
echo    "push_visitor_alerts"   BOOLEAN     NOT NULL DEFAULT true,
echo    "login_mpin_enabled"    BOOLEAN     NOT NULL DEFAULT true,
echo    "login_biometric"       BOOLEAN     NOT NULL DEFAULT false,
echo    "login_otp_only"        BOOLEAN     NOT NULL DEFAULT false,
echo    "app_name"              VARCHAR(100),
echo    "theme_color"           VARCHAR(7),
echo    "logo_url"              TEXT,
echo    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
echo    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
echo    CONSTRAINT "mobile_config_pkey" PRIMARY KEY ("id")
echo  );
echo  CREATE UNIQUE INDEX "mobile_config_association_id_key"
echo    ON "mobile_config"("association_id");
echo  ALTER TABLE "mobile_config" ADD CONSTRAINT "mobile_config_association_id_fkey"
echo    FOREIGN KEY ("association_id") REFERENCES "associations"("id")
echo    ON DELETE CASCADE ON UPDATE CASCADE;
echo  ------------------------------------------
echo.
cd /d "%~dp0"
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/20260724000002_add_mobile_config/migration.sql
git add backend/src/modules/system/system.service.ts
git add backend/src/modules/system/system.controller.ts
git add backend/src/modules/system/system.routes.ts
git add frontend/src/store/api/systemApi.ts
git add frontend/src/store/api/baseApi.ts
git add frontend/src/pages/admin/MenuConfigPage.tsx
git commit -m "feat: Mobile App system settings — feature toggles, push config, login options, branding"
git push
echo.
echo Done!
pause
