-- Internal chat: direct messages and group channels between association
-- members.
--
-- SUPER_USER and GATE_STAFF are never members of a chat_channel. That is
-- enforced in application code (the directory and the create-channel
-- endpoints never offer either role), not by a database constraint — the
-- same posture as every other role-shaped restriction in this schema.

CREATE TYPE "ChatChannelType" AS ENUM ('DIRECT', 'GROUP');

CREATE TABLE "chat_channels" (
    "id"              UUID              NOT NULL DEFAULT gen_random_uuid(),
    "association_id"  UUID              NOT NULL,
    "type"            "ChatChannelType" NOT NULL,
    "name"            VARCHAR(120),
    "created_by"      UUID              NOT NULL,
    "last_message_at" TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"      TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ       NOT NULL,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_channel_members" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "channel_id"   UUID        NOT NULL,
    "user_id"      UUID        NOT NULL,
    "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" UUID        NOT NULL,
    "sender_id"  UUID        NOT NULL,
    "content"    TEXT        NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_channel_members_channel_id_user_id_key"
    ON "chat_channel_members" ("channel_id", "user_id");

CREATE INDEX "chat_channels_association_id_last_message_at_idx"
    ON "chat_channels" ("association_id", "last_message_at");

CREATE INDEX "chat_channel_members_user_id_idx"
    ON "chat_channel_members" ("user_id");

CREATE INDEX "chat_messages_channel_id_created_at_idx"
    ON "chat_messages" ("channel_id", "created_at");

ALTER TABLE "chat_channels"
    ADD CONSTRAINT "chat_channels_association_id_fkey"
    FOREIGN KEY ("association_id") REFERENCES "associations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_channels"
    ADD CONSTRAINT "chat_channels_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
