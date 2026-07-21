import prisma from '../../config/database';
import { notificationService } from '../../services/notification.service';
import { BillStatus } from '@prisma/client';
import logger from '../../utils/logger';

const REMINDER_OFFSETS = [-7, 0, 7, 14]; // days relative to due_date

export const runDuesReminder = async (): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const offset of REMINDER_OFFSETS) {
    const targetDate = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
    const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const unpaidBills = await prisma.bill.findMany({
      where: {
        due_date: { gte: targetDate, lt: nextDate },
        status: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] },
      },
      include: {
        unit: { include: { users: { where: { is_active: true, deleted_at: null }, select: { id: true } } } },
      },
    });

    for (const bill of unpaidBills) {
      const recipients = bill.unit.users.map((u) => u.id);
      if (!recipients.length) continue;

      await notificationService.dispatch({
        type: 'DUES_REMINDER',
        channels: ['PUSH', 'SMS'],
        recipients,
        data: { bill_id: bill.id, amount: String(bill.total_amount), due_date: bill.due_date.toISOString(), offset_days: String(offset) },
      });
    }
  }

  logger.info('Dues reminders dispatched');
};
