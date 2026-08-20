import prisma from '../../config/database';
import { notificationService } from '../../services/notification.service';
import { journalService } from '../../modules/accounting/journal.service';
import { ensureVendorBP } from '../../modules/accounting/bp-type.seed';
import { ExpenseStatus, ExpenseFrequency, UserRole } from '@prisma/client';
import logger from '../../utils/logger';

const isLastDayOfMonth = (date: Date): boolean => {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
};

// Month-end accrual for recurring expenses that opted into provisioning
// (RecurringExpense.auto_provision) and haven't actually been recorded yet
// this month. Runs nightly but only does anything on the last calendar day
// of the month — matches the existing recurring-expense-poller's "run daily,
// let the query decide if there's work" shape rather than trying to compute
// "the 28th/30th/31st" up front.
//
// Scoped to MONTHLY items only: quarterly/half-yearly/annual accruals are an
// amortisation problem (spreading 1/3rd, 1/6th, 1/12th of the amount across
// months), not a "did this month's bill show up yet" problem, and aren't
// handled here.
export const runExpenseProvisioner = async (): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!isLastDayOfMonth(today)) return;

  const periodYear = today.getFullYear();
  const periodMonth = today.getMonth() + 1;
  const monthStart = new Date(periodYear, periodMonth - 1, 1);
  const monthEnd = new Date(periodYear, periodMonth, 1);

  const candidates = await prisma.recurringExpense.findMany({
    where: { is_active: true, auto_provision: true, frequency: ExpenseFrequency.MONTHLY },
    include: { vendor: true },
  });

  for (const rec of candidates) {
    try {
      // auto_provision requires a vendor at write time (expenses.service.ts),
      // but guard here too rather than trust that invariant blindly — a
      // vendor could in principle be deleted out from under an existing
      // recurring item.
      if (!rec.vendor) {
        logger.error('Recurring expense has auto_provision on but no vendor — skipping', { recurring_id: rec.id });
        continue;
      }

      // Idempotency: a provision already exists for this recurring item this
      // month (e.g. the job ran twice, or was fired manually for a retry).
      const existingProvision = await prisma.expenseProvision.findUnique({
        where: {
          recurring_expense_id_period_year_period_month: {
            recurring_expense_id: rec.id,
            period_year: periodYear,
            period_month: periodMonth,
          },
        },
      });
      if (existingProvision) continue;

      // Already actually posted this period through the normal channel —
      // nothing to accrue for, the books are already correct.
      const alreadyRecorded = await prisma.expense.findFirst({
        where: {
          recurring_id: rec.id,
          expense_date: { gte: monthStart, lt: monthEnd },
          status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.RECORDED] },
        },
      });
      if (alreadyRecorded) continue;

      const businessPartnerId = await ensureVendorBP(rec.association_id, rec.vendor);

      const provision = await prisma.expenseProvision.create({
        data: {
          association_id: rec.association_id,
          recurring_expense_id: rec.id,
          period_year: periodYear,
          period_month: periodMonth,
          amount: rec.amount,
        },
      });

      const journalEntryId = await journalService.postExpenseProvision(
        rec.association_id,
        provision.id,
        rec.category,
        Number(rec.amount),
        businessPartnerId,
        `${rec.description} — month-end accrual (${rec.vendor.name})`,
        today,
      );

      await prisma.expenseProvision.update({
        where: { id: provision.id },
        data: { provisioning_journal_entry_id: journalEntryId },
      });

      const treasurers = await prisma.user.findMany({
        where: { association_id: rec.association_id, role: UserRole.TREASURER, is_active: true, deleted_at: null },
        select: { id: true },
      });
      await notificationService.dispatch({
        type: 'EXPENSE_PROVISIONED',
        channels: ['PUSH'],
        recipients: treasurers.map((t) => t.id),
        data: { description: rec.description, amount: String(rec.amount) },
      });

      logger.info('Recurring expense provisioned', { recurring_id: rec.id, provision_id: provision.id });
    } catch (err) {
      logger.error('Recurring expense provisioning failed', { recurring_id: rec.id, error: err });
    }
  }
};
