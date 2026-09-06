-- Lets an association turn OFF automatic nightly posting for a specific
-- recurring expense, requiring a manual "Post Now" click each cycle instead.
-- Defaults to true so every existing recurring expense keeps behaving exactly
-- as it does today (auto-posted on next_due_date) with no migration-time
-- backfill needed.
ALTER TABLE "recurring_expenses"
    ADD COLUMN "auto_post" BOOLEAN NOT NULL DEFAULT true;
