import prisma from '../../config/database';
import { VisitorStatus } from '@prisma/client';
import logger from '../../utils/logger';

export const runVisitorQrExpiry = async (): Promise<void> => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const result = await prisma.visitor.updateMany({
    where: {
      status: VisitorStatus.APPROVED,
      visit_type: 'PRE_APPROVED',
      expected_at: { lt: twoHoursAgo },
      entered_at: null,
    },
    data: { status: VisitorStatus.EXPIRED },
  });

  if (result.count > 0) logger.info('Expired visitor QR tokens', { count: result.count });
};
