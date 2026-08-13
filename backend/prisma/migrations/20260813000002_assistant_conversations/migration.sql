-- Assistant conversations and their audit trail.
--
-- `assistant_messages.tool_calls` is the point of this pair of tables. A chat
-- transcript on its own cannot answer "why did it tell her she owed nothing" —
-- the tool name, the arguments it ran with, and a summary of what came back
-- are what make an answer reproducible months later.

CREATE TYPE "AssistantAuthor" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "assistant_conversations" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "association_id"  UUID         NOT NULL,
    "user_id"         UUID         NOT NULL,
    "title"           VARCHAR(160),
    "role_at_start"   "UserRole"   NOT NULL,
    "last_message_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_messages" (
    "id"              UUID              NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID              NOT NULL,
    "author"          "AssistantAuthor" NOT NULL,
    "content"         TEXT              NOT NULL,
    "tool_calls"      JSONB,
    "proposed_action" JSONB,
    "action_status"   VARCHAR(20),
    "input_tokens"    INTEGER           NOT NULL DEFAULT 0,
    "output_tokens"   INTEGER           NOT NULL DEFAULT 0,
    "model"           VARCHAR(60),
    "error"           TEXT,
    "created_at"      TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_conversations_association_id_user_id_last_message_idx"
    ON "assistant_conversations" ("association_id", "user_id", "last_message_at");

CREATE INDEX "assistant_messages_conversation_id_created_at_idx"
    ON "assistant_messages" ("conversation_id", "created_at");

ALTER TABLE "assistant_conversations"
    ADD CONSTRAINT "assistant_conversations_association_id_fkey"
    FOREIGN KEY ("association_id") REFERENCES "associations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_conversations"
    ADD CONSTRAINT "assistant_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_messages"
    ADD CONSTRAINT "assistant_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
