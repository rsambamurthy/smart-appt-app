import prisma from '../../config/database';
import { notificationService } from '../../services/notification.service';
import { ExpenseStatus, ExpenseFrequency, UserRole } from '@prisma/client';
import logger from '../../utils/logger';

const nextDueDate = (current: Date, frequency: ExpenseFrequency): Date => {
  const d = new Date(current);
  switch (frequency) {
    case ExpenseFrequency.MONTHLY: d.setMonth(d.getMonth() + 1); break;
    case ExpenseFrequency.QUARTERLY: d.setMonth(d.getMonth() + 3); break;
    case ExpenseFrequency.HALF_YEARLY: d.setMonth(d.getMonth() + 6); break;
    case ExpenseFrequency.ANNUAL: d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
};

export const runRecurringExpensePoller = async (): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const due = await prisma.recurringExpense.findMany({
    where: { is_active: true, next_due_date: { gte: today, lt: tomorrow } },
  });

  for (const rec of due) {
    // Idempotency: check if expense already created today
    const existing = await prisma.expense.findFirst({
      where: { recurring_id: rec.id, expense_date: { gte: today, lt: tomorrow } },
    });
    if (existing) continue;

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

    await prisma.recurringExpense.update({ where: { id: rec.id }, data: { next_due_date: nextDueDate(today, rec.frequency) } });

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
  }
};
