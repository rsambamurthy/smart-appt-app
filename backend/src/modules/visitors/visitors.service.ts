import prisma from '../../config/database';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../utils/errors';
import { generateToken } from '../../utils/helpers';
import { notificationService } from '../../services/notification.service';
import { io } from '../../app';
import { VisitorStatus, VisitType, UserRole } from '@prisma/client';

export class VisitorsService {
  async preApprove(associationId: string, residentId: string, unitId: string, body: {
    name: string; phone?: string; expected_at: string; purpose?: string; vehicle_number?: string;
  }) {
    const qrToken = generateToken(16);
    const visitor = await prisma.visitor.create({
      data: {
        association_id: associationId,
        unit_id: unitId,
        resident_id: residentId,
        visitor_name: body.name,
        visitor_phone: body.phone,
        purpose: body.purpose,
        visit_type: VisitType.PRE_APPROVED,
        status: VisitorStatus.APPROVED,
        qr_token: qrToken,
        expected_at: new Date(body.expected_at),
        vehicle_number: body.vehicle_number,
        logged_by: residentId,
      },
    });
    return { data: { visitor_id: visitor.id, qr_token: qrToken } };
  }

  async walkIn(associationId: string, staffId: string, body: {
    visitor_name: string; visitor_phone?: string; unit_id: string;
    purpose?: string; vehicle_number?: string;
  }) {
    const unit = await prisma.unit.findFirst({ where: { id: body.unit_id, association_id: associationId } });
    if (!unit) throw new NotFoundError('Unit');

    const resident = await prisma.user.findFirst({
      where: { unit_id: body.unit_id, role: UserRole.RESIDENT, is_active: true, deleted_at: null },
    });
    if (!resident) throw new UnprocessableError('No resident found for this unit.');

    const visitor = await prisma.visitor.create({
      data: {
        association_id: associationId,
        unit_id: body.unit_id,
        resident_id: resident.id,
        visitor_name: body.visitor_name,
        visitor_phone: body.visitor_phone,
        purpose: body.purpose,
        visit_type: VisitType.WALK_IN,
        status: VisitorStatus.PENDING,
        vehicle_number: body.vehicle_number,
        logged_by: staffId,
      },
    });

    // Push real-time notification to resident's unit room
    io.to(`unit:${body.unit_id}`).emit('visitor:walkin', {
      visitor_id: visitor.id,
      visitor_name: body.visitor_name,
      purpose: body.purpose,
    });

    await notificationService.dispatch({
      type: 'VISITOR_WALKIN',
      channels: ['PUSH'],
      recipients: [resident.id],
      data: { visitor_id: visitor.id, visitor_name: body.visitor_name },
    });

    return { data: visitor };
  }

  async approveVisitor(associationId: string, visitorId: string, residentId: string, decision: 'APPROVED' | 'DENIED') {
    const visitor = await prisma.visitor.findFirst({ where: { id: visitorId, association_id: associationId } });
    if (!visitor) throw new NotFoundError('Visitor');
    if (visitor.resident_id !== residentId) throw new ForbiddenError();

    const newStatus = decision === 'APPROVED' ? VisitorStatus.APPROVED : VisitorStatus.DENIED;
    await prisma.visitor.update({ where: { id: visitorId }, data: { status: newStatus } });

    // Notify gate via Socket.io
    io.to(`gate:${associationId}`).emit('visitor:decision', { visitor_id: visitorId, decision });

    return { data: { visitor_id: visitorId, status: newStatus } };
  }

  async recordEntry(associationId: string, visitorId: string) {
    const visitor = await prisma.visitor.findFirst({ where: { id: visitorId, association_id: associationId } });
    if (!visitor) throw new NotFoundError('Visitor');
    if (visitor.status !== VisitorStatus.APPROVED) throw new UnprocessableError('Visitor is not approved for entry.');

    await prisma.visitor.update({ where: { id: visitorId }, data: { status: VisitorStatus.ENTERED, entered_at: new Date() } });

    await notificationService.dispatch({
      type: 'VISITOR_ENTRY',
      channels: ['PUSH'],
      recipients: [visitor.resident_id],
      data: { visitor_id: visitorId, visitor_name: visitor.visitor_name },
    });

    return { data: { message: 'Entry recorded' } };
  }

  async recordExit(associationId: string, visitorId: string) {
    const visitor = await prisma.visitor.findFirst({ where: { id: visitorId, association_id: associationId } });
    if (!visitor) throw new NotFoundError('Visitor');

    await prisma.visitor.update({ where: { id: visitorId }, data: { status: VisitorStatus.EXITED, exited_at: new Date() } });
    return { data: { message: 'Exit recorded' } };
  }

  async getLog(associationId: string, query: { cursor?: string; limit: number; unit_id?: string; date?: string; visit_type?: string; status?: string }) {
    const where: Record<string, unknown> = { association_id: associationId };
    if (query.unit_id) where['unit_id'] = query.unit_id;
    if (query.visit_type) where['visit_type'] = query.visit_type;
    if (query.status) where['status'] = query.status;
    if (query.date) {
      const d = new Date(query.date);
      where['created_at'] = { gte: d, lt: new Date(d.getTime() + 86400000) };
    }
    if (query.cursor) where['id'] = { gt: query.cursor };

    const logs = await prisma.visitor.findMany({
      where: where as never,
      take: query.limit,
      include: { unit: { select: { flat_number: true, block: true } }, logger: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return { data: logs, meta: { next_cursor: logs.length === query.limit ? logs[logs.length - 1].id : null, count: logs.length } };
  }

  async lookupByQr(associationId: string, qrToken: string) {
    const visitor = await prisma.visitor.findFirst({
      where: { qr_token: qrToken, association_id: associationId },
      include: { unit: { select: { flat_number: true, block: true } }, resident: { select: { name: true, phone: true } } },
    });
    if (!visitor) throw new NotFoundError('QR token');
    return { data: visitor };
  }

  async addFrequentVisitor(associationId: string, residentId: string, unitId: string, body: {
    name: string; phone?: string; role?: string;
    access_days: number[]; access_from: string; access_until: string;
  }) {
    const fv = await prisma.frequentVisitor.create({
      data: {
        association_id: associationId,
        unit_id: unitId,
        resident_id: residentId,
        name: body.name,
        phone: body.phone,
        role: body.role,
        access_days: body.access_days,
        access_from: body.access_from,
        access_until: body.access_until,
      },
    });
    return { data: fv };
  }

  async listFrequentVisitors(associationId: string, residentId: string) {
    const items = await prisma.frequentVisitor.findMany({
      where: { association_id: associationId, resident_id: residentId, is_active: true },
    });
    return { data: items };
  }

  async updateFrequentVisitor(associationId: string, fvId: string, residentId: string, body: Partial<{ name: string; phone: string; is_active: boolean; access_days: number[]; access_from: string; access_until: string }>) {
    const fv = await prisma.frequentVisitor.findFirst({ where: { id: fvId, association_id: associationId, resident_id: residentId } });
    if (!fv) throw new NotFoundError('Frequent visitor');
    const updated = await prisma.frequentVisitor.update({ where: { id: fvId }, data: body });
    return { data: updated };
  }

  async triggerEmergency(associationId: string, staffId: string, body: { note: string; location?: string }) {
    const managers = await prisma.user.findMany({
      where: { association_id: associationId, role: { in: [UserRole.MANAGER, UserRole.COMMITTEE] }, is_active: true, deleted_at: null },
      select: { id: true },
    });

    await notificationService.dispatch({
      type: 'EMERGENCY_ALERT',
      channels: ['PUSH', 'SMS'],
      recipients: managers.map((m) => m.id),
      data: { note: body.note, location: body.location, reported_by: staffId },
    });

    return { data: { message: 'Emergency alert dispatched', notified: managers.length } };
  }
}

export const visitorsService = new VisitorsService();
