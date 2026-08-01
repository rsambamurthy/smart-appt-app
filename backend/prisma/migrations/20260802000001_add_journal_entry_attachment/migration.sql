-- Supporting document for a journal entry (invoice, receipt, bank slip).
-- Stored in-row like documents.file_data. Nullable, so existing entries are
-- unaffected and no backfill is needed.
ALTER TABLE "journal_entries" ADD COLUMN     "file_data" BYTEA,
ADD COLUMN     "file_name" VARCHAR(255),
ADD COLUMN     "mime_type" VARCHAR(100);
