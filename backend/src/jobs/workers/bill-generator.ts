import prisma from '../../config/database';
import { notificationService } from '../../services/notification.service';
import { BillStatus, UserRole } from '@prisma/client';
import logger from '../../utils/logger';
import redis from '../../config/redis';

export const runBillGenerator = async (): Promise<void> => {
  const lockKey = 'lock:bill-generator';
  const lock = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
  if (!lock) { logger.info('Bill generator already running, skipping'); return; }

  try {
    const today = new Date();
    const configs = await prisma.duesConfig.findMany({ include: { association: true } });

    for (const config of configs) {
      if (config.due_day !== today.getDate()) continue;

      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      const units = await prisma.unit.findMany({ where: { association_id: config.association_id } });

      for (const unit of units) {
        const existing = await prisma.bill.findFirst({ where: { unit_id: unit.id, period_month: month, period_year: year } });
        if (existing) continue;

        await prisma.bill.create({
          data: {
            association_id: config.association_id,
            unit_id: unit.id,
            period_month: month,
            period_year: year,
            base_amount: config.monthly_charge,
            penalty: 0,
            levy_amount: 0,
            total_amount: config.monthly_charge,
            due_date: new Date(year, month - 1, config.due_day),
            status: BillStatus.UNPAID,
          },
        });
      }

      const residents = await prisma.user.findMany({
        where: { association_id: config.association_id, role: UserRole.RESIDENT, is_active: true, deleted_at: null },
        select: { id: true },
      });
      await notificationService.dispatch({ type: 'BILL_GENERATED', channels: ['PUSH', 'EMAIL'], recipients: residents.map((r) => r.id), data: { month, year } });
      logger.info('Bills generated', { association_id: config.association_id, month, year });
    }
  } finally {
    await redis.del(lockKey);
  }
};
