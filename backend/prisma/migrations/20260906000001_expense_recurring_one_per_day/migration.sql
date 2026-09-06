-- Closes the race that let a recurring expense be posted twice for the same
-- day: postRecurringNow (manual "Post Now") and the nightly poller
-- (recurring-expense-poller.ts) both do a plain "does today's expense exist
-- yet?" check followed by a create, with nothing at the database level
-- stopping two near-simultaneous calls from both passing that check and
-- both inserting.
--
-- IMPORTANT — run this only after cleaning up any existing duplicates
-- (deleting the extra Expense row via the Expenses screen, which now also
-- cancels its posted journal entry — see expensesService.deleteExpense).
-- This index validates against current data when created, so it will fail
-- to apply while a real duplicate (recurring_id, expense_date) pair still
-- exists with deleted_at IS NULL on both rows.
--
-- A partial index, not a plain @@unique in schema.prisma (which can't
-- express a WHERE clause) — same convention already used for
-- bill_penalties_one_live_per_bill:
--   * recurring_id IS NOT NULL — only recurring-originated expenses are
--     scoped by this at all; a one-off expense never sets recurring_id, so
--     unrelated manual expenses on the same date never collide.
--   * deleted_at IS NULL — a soft-deleted duplicate (the exact cleanup this
--     migration depends on, and any future correction) frees up the slot,
--     so deleting a bad duplicate and legitimately re-posting for that same
--     day still works.
CREATE UNIQUE INDEX "expenses_recurring_one_per_day"
    ON "expenses"("recurring_id", "expense_date")
    WHERE "recurring_id" IS NOT NULL AND "deleted_at" IS NULL;
