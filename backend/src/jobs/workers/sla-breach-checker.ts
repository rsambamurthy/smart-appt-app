import prisma from '../../config/database';
import { notificationService } from '../../services/notification.service';
import { TicketStatus, UserRole } from '@prisma/client';
import logger from '../../utils/logger';

export const runSlaBreachChecker = async (): Promise<void> => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const breached = await prisma.maintenanceTicket.findMany({
    where: {
      sla_due_at: { lt: now },
      sla_breached: false,
      status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
    },
    select: { id: true, association_id: true, title: true, priority: true },
  });

  for (const ticket of breached) {
    await prisma.maintenanceTicket.update({ where: { id: ticket.id }, data: { sla_breached: true } });

    const managers = await prisma.user.findMany({
      where: { association_id: ticket.association_id, role: UserRole.MANAGER, is_active: true, deleted_at: null },
      select: { id: true },
    });

    await notificationService.dispatch({
      type: 'SLA_BREACH',
      channels: ['PUSH', 'EMAIL'],
      recipients: managers.map((m) => m.id),
      data: { ticket_id: ticket.id, title: ticket.title, priority: ticket.priority },
    });

    logger.info('SLA breach flagged', { ticket_id: ticket.id });
  }
};
