import prisma from '../../config/database';
import { notificationService } from '../../services/notification.service';
import { ExpenseStatus, UserRole, Prisma } from '@prisma/client';
import { nextRecurringDueDate } from '../../utils/helpers';
import logger from '../../utils/logger';

export const runRecurringExpensePoller = async (): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  // Catch anything due today OR overdue (next_due_date in the past), not
  // just an exact match on today. A narrow `gte: today` window means a
  // single missed run (the poller not being wired up at all, a deploy, a
  // restart at the wrong moment) leaves that item stuck forever — its
  // due date never advances, so a same-day-only window can never see it
  // again once "today" moves past it.
  const due = await prisma.recurringExpense.findMany({
    where: { is_active: true, next_due_date: { lt: tomorrow } },
  });

  for (const rec of due) {
    try {
      // Idempotency: check if expense already created today. This is a
      // check, not a lock — the same race a same-second "Post Now" click can
      // hit (see expensesService.postRecurringNow) applies here too, so the
      // real guarantee is the partial unique index
      // expenses_recurring_one_per_day (migration
      // 20260906000001_expense_recurring_one_per_day), caught below.
      const existing = await prisma.expense.findFirst({
        where: { recurring_id: rec.id, expense_date: { gte: today, lt: tomorrow } },
      });
      if (existing) continue;

      if (!rec.auto_post) {
        // Auto-posting is deliberately off for this item — the whole point is
        // that a human decides each cycle, so don't create the expense or
        // advance next_due_date; leave it due so it keeps surfacing here.
        // That means this reminder resends every night the item remains
        // due-and-unposted (not a bug — that's the nag this setting exists
        // for). Reuses the same TREASURER recipient list and PUSH channel as
        // the auto-post path, just a different, more explicit message.
        const treasurersToNudge = await prisma.user.findMany({
          where: { association_id: rec.association_id, role: UserRole.TREASURER, is_active: true, deleted_at: null },
          select: { id: true },
        });

        await notificationService.dispatch({
          type: 'RECURRING_EXPENSE_NEEDS_MANUAL_POST',
          channels: ['PUSH'],
          recipients: treasurersToNudge.map((t) => t.id),
          data: { description: rec.description, amount: String(rec.amount) },
        });

        logger.info('Recurring expense due but auto_post is off — skipped, reminder sent', { recurring_id: rec.id });
        continue;
      }

      await prisma.expense.create({
        data: {
          association_id: rec.association_id,
          expense_date: today,
          category: rec.category,
          vendor_id: rec.vendor_id,
          amount: rec.amount,
          payment_mode: 'CASH',
          description: rec.description,
          status: ExpenseStatus.PENDING_APPROVAL,
          is_recurring: true,
          recurring_id: rec.id,
          created_by: rec.created_by,
        },
      });

      // Advance from the item's own scheduled date, not from "today" — so a
      // late/catch-up run doesn't drag the day-of-month forward with it (a
      // monthly item due on the 1st stays due on the 1st, even if this
      // particular run happened on the 4th).
      await prisma.recurringExpense.update({ where: { id: rec.id }, data: { next_due_date: nextRecurringDueDate(rec.next_due_date, rec.frequency) } });

      const treasurers = await prisma.user.findMany({
        where: { association_id: rec.association_id, role: UserRole.TREASURER, is_active: true, deleted_at: null },
        select: { id: true },
      });

      await notificationService.dispatch({
        type: 'RECURRING_EXPENSE_DUE',
        channels: ['PUSH'],
        recipients: treasurers.map((t) => t.id),
        data: { description: rec.description, amount: String(rec.amount) },
      });

      logger.info('Recurring expense created', { recurring_id: rec.id });
    } catch (err) {
      // Lost the race to a same-second manual "Post Now" (or another run of
      // this same poller) — not a failure, just the other side winning.
      // Anything else is a real error and shouldn't stop the rest of `due`
      // from being processed (matches expense-provisioner.ts's own
      // per-item try/catch, so one bad item can't starve every other
      // association's recurring expense for a whole run).
      const alreadyPosted = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!alreadyPosted) {
        logger.error('Recurring expense poller failed for one item', { recurring_id: rec.id, error: err });
      }
    }
  }
};
