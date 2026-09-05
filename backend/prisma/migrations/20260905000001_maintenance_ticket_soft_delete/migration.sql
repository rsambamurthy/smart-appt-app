-- Soft delete for maintenance tickets, so a Manager can remove a CLOSED
-- (or any other) ticket from the working list without destroying the
-- underlying history — same convention already used on units, users,
-- expenses, documents, other_receipts and chat_messages: a nullable
-- deleted_at, filtered out with `deleted_at IS NULL` at every read site
-- rather than an actual DELETE.
ALTER TABLE "maintenance_tickets"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;
