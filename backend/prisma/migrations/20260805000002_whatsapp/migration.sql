-- WhatsApp: consent, and a record of every message attempted.
--
-- Two things drive this shape.
--
-- CONSENT IS PERSONAL. Meta requires demonstrable opt-in, and an association
-- turning the feature on is not consent from the resident. So it lives on the
-- user, with the timestamp, because "when did they agree" is the question
-- actually asked when a complaint arrives.
--
-- WHATSAPP FAILS QUIETLY. Templates get paused, numbers hit tier limits,
-- residents block senders. None of that surfaces anywhere unless it is
-- written down, and the first symptom is otherwise a committee asking why
-- nobody received their bill.

ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "whatsapp_opted_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "whatsapp_phone"    VARCHAR(20);

CREATE TYPE "WhatsAppStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE "whatsapp_messages" (
    "id"             UUID             NOT NULL DEFAULT gen_random_uuid(),
    "association_id" UUID             NOT NULL,
    "user_id"        UUID,

    "to_phone"       VARCHAR(20)      NOT NULL,
    "template"       VARCHAR(100)     NOT NULL,
    "variables"      JSONB,

    "reference_type" VARCHAR(50),
    "reference_id"   UUID,

    "status"         "WhatsAppStatus" NOT NULL DEFAULT 'QUEUED',
    "wa_message_id"  VARCHAR(120),
    "error_code"     VARCHAR(40),
    "error_message"  TEXT,

    "sent_at"        TIMESTAMPTZ,
    "delivered_at"   TIMESTAMPTZ,
    "read_at"        TIMESTAMPTZ,
    "failed_at"      TIMESTAMPTZ,

    -- @updatedAt is written by the Prisma client and has no database default.
    "created_at"     TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_association_id_fkey"
  FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Delivery webhooks arrive against Meta's id, so the lookup must be fast and
-- unique. Meta can resend the same status, and a duplicate row would make the
-- log lie about how many messages were sent.
CREATE UNIQUE INDEX "whatsapp_messages_wa_message_id_key"
    ON "whatsapp_messages"("wa_message_id")
    WHERE "wa_message_id" IS NOT NULL;

CREATE INDEX "whatsapp_messages_assoc_created_idx" ON "whatsapp_messages"("association_id", "created_at");
CREATE INDEX "whatsapp_messages_reference_idx"     ON "whatsapp_messages"("reference_type", "reference_id");
CREATE INDEX "whatsapp_messages_status_idx"        ON "whatsapp_messages"("status");

-- Opting in must record when. A consent with no date cannot be defended.
ALTER TABLE "users"
  ADD CONSTRAINT "users_whatsapp_consent_dated"
  CHECK ("whatsapp_opt_in" = false OR "whatsapp_opted_at" IS NOT NULL);
