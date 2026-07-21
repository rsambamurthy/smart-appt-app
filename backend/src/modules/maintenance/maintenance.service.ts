import prisma from '../../config/database';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../utils/errors';
import { computeSlaDueAt, paginatedResponse } from '../../utils/helpers';
import { notificationService } from '../../services/notification.service';
import { CreateTicketBody, AssignTicketBody, UpdateStatusBody, FeedbackBody } from './maintenance.schema';
import { TicketStatus, UserRole } from '@prisma/client';

export class MaintenanceService {
  async createTicket(
    associationId: string,
    userId: string,
    unitId: string,
    body: CreateTicketBody,
    attachmentKeys: string[],
  ) {
    const ticket = await prisma.maintenanceTicket.create({
      data: {
        association_id: associationId,
        unit_id: unitId,
        raised_by: userId,
        ...body,
        attachments: attachmentKeys.length
          ? {
              create: attachmentKeys.map((key) => ({
                association_id: associationId,
                s3_key: key,
                mime_type: 'image/jpeg',
                size_bytes: 0,
              })),
            }
          : undefined,
        status_logs: {
          create: {
            association_id: associationId,
            from_status: null,
            to_status: TicketStatus.SUBMITTED,
            changed_by: userId,
          },
        },
      },
      include: { attachments: true },
    });

    // Notify managers
    const managers = await prisma.user.findMany({
      where: { association_id: associationId, role: UserRole.MANAGER, is_active: true, deleted_at: null },
      select: { id: true },
    });

    await notificationService.dispatch({
      type: 'TICKET_CREATED',
      channels: ['PUSH', 'EMAIL'],
      recipients: managers.map((m) => m.id),
      data: { ticket_id: ticket.id, title: body.title, priority: body.priority },
    });

    return { data: ticket };
  }

  async listTickets(
    associationId: string,
    query: {
      cursor?: string; limit: number; status?: string; category?: string;
      priority?: string; unit_id?: string; assigned_to?: string;
      date_from?: string; date_to?: string;
    },
  ) {
    const where: Record<string, unknown> = { association_id: associationId };
    if (query.status) where['status'] = query.status;
    if (query.category) where['category'] = query.category;
    if (query.priority) where['priority'] = query.priority;
    if (query.unit_id) where['unit_id'] = query.unit_id;
    if (query.assigned_to) where['assigned_to'] = query.assigned_to;
    if (query.date_from || query.date_to) {
      where['created_at'] = {};
      if (query.date_from) (where['created_at'] as Record<string, unknown>)['gte'] = new Date(query.date_from);
      if (query.date_to) (where['created_at'] as Record<string, unknown>)['lte'] = new Date(query.date_to);
    }
    if (query.cursor) where['id'] = { gt: query.cursor };

    const tickets = await prisma.maintenanceTicket.findMany({
      where: where as never,
      take: query.limit,
      include: {
        unit: { select: { flat_number: true, block: true } },
        raiser: { select: { name: true, phone: true } },
        assignee: { select: { name: true } },
        attachments: { select: { s3_key: true, mime_type: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return paginatedResponse(tickets as (typeof tickets[0] & { id: string })[], query.limit);
  }

  async getTicket(associationId: string, ticketId: string, userId: string, role: UserRole) {
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, association_id: associationId },
      include: {
        unit: true,
        raiser: { select: { name: true, phone: true } },
        assignee: { select: { name: true, phone: true } },
        attachments: true,
        status_logs: { include: { changer: { select: { name: true } } }, orderBy: { created_at: 'asc' } },
      },
    });

    if (!ticket) throw new NotFoundError('Ticket');
    if (role === UserRole.RESIDENT && ticket.raised_by !== userId) throw new ForbiddenError();

    return { data: ticket };
  }

  async assignTicket(associationId: string, ticketId: string, body: AssignTicketBody, performedBy: string) {
    const ticket = await prisma.maintenanceTicket.findFirst({ where: { id: ticketId, association_id: associationId } });
    if (!ticket) throw new NotFoundError('Ticket');

    const now = new Date();
    const slaAt = body.sla_due_at ? new Date(body.sla_due_at) : computeSlaDueAt(ticket.priority, now);

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        assigned_to: body.assigned_to,
        assigned_at: now,
        sla_due_at: slaAt,
        status: TicketStatus.ACKNOWLEDGED,
        status_logs: {
          create: {
            association_id: associationId,
            from_status: ticket.status,
            to_status: TicketStatus.ACKNOWLEDGED,
            changed_by: performedBy,
            note: body.note,
          },
        },
      },
    });

    await notificationService.dispatch({
      type: 'TICKET_ASSIGNED',
      channels: ['PUSH'],
      recipients: [body.assigned_to, ticket.raised_by],
      data: { ticket_id: ticketId },
    });

    return { data: updated };
  }

  async updateStatus(associationId: string, ticketId: string, body: UpdateStatusBody, performedBy: string) {
    const ticket = await prisma.maintenanceTicket.findFirst({ where: { id: ticketId, association_id: associationId } });
    if (!ticket) throw new NotFoundError('Ticket');

    const now = new Date();
    const extra: Record<string, unknown> = {};
    if (body.status === TicketStatus.RESOLVED) extra['resolved_at'] = now;
    if (body.status === TicketStatus.CLOSED) extra['closed_at'] = now;

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: body.status,
        ...extra,
        status_logs: {
          create: {
            association_id: associationId,
            from_status: ticket.status,
            to_status: body.status,
            changed_by: performedBy,
            note: body.note,
          },
        },
      },
    });

    await notificationService.dispatch({
      type: 'TICKET_STATUS_CHANGED',
      channels: ['PUSH'],
      recipients: [ticket.raised_by],
      data: { ticket_id: ticketId, status: body.status },
    });

    return { data: updated };
  }

  async submitFeedback(associationId: string, ticketId: string, userId: string, body: FeedbackBody) {
    const ticket = await prisma.maintenanceTicket.findFirst({ where: { id: ticketId, association_id: associationId } });
    if (!ticket) throw new NotFoundError('Ticket');
    if (ticket.raised_by !== userId) throw new ForbiddenError();
    if (ticket.status !== TicketStatus.RESOLVED) throw new UnprocessableError('Feedback can only be submitted on RESOLVED tickets.');

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: { rating: body.rating, rating_comment: body.comment, status: TicketStatus.CLOSED, closed_at: new Date() },
    });

    return { data: updated };
  }

  async getDashboard(associationId: string) {
    const [openByCategory, slaBreaches, avgResolution] = await Promise.all([
      prisma.maintenanceTicket.groupBy({
        by: ['category'],
        where: { association_id: associationId, status: { notIn: [TicketStatus.CLOSED, TicketStatus.RESOLVED] } },
        _count: { id: true },
      }),
      prisma.maintenanceTicket.count({
        where: { association_id: associationId, sla_breached: true, status: { notIn: [TicketStatus.CLOSED] } },
      }),
      prisma.$queryRaw<{ avg_hours: number }[]>`
        SELECT EXTRACT(EPOCH FROM AVG(resolved_at - created_at))/3600 AS avg_hours
        FROM maintenance_tickets
        WHERE association_id = ${associationId}::uuid
          AND resolved_at IS NOT NULL
          AND created_at > NOW() - INTERVAL '30 days'
      `,
    ]);

    return {
      data: {
        open_by_category: openByCategory,
        sla_breaches: slaBreaches,
        avg_resolution_hours: avgResolution[0]?.avg_hours ?? 0,
      },
    };
  }
}

export const maintenanceService = new MaintenanceService();
