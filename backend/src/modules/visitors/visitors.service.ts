import prisma from '../../config/database';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../utils/errors';
import { generateToken } from '../../utils/helpers';
import { notificationService } from '../../services/notification.service';
import { io } from '../../app';
import { VisitorStatus, VisitType, UserRole, DeliveryStatus } from '@prisma/client';

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

    // Whoever answers for this flat. Previously this required role RESIDENT,
    // so a flat occupied only by a committee member or treasurer could not
    // receive a walk-in at all. Owner first, then longest-standing occupant.
    const resident = await prisma.user.findFirst({
      where:   { unit_id: body.unit_id, is_active: true, deleted_at: null },
      orderBy: [{ is_owner: 'desc' }, { created_at: 'asc' }],
    });
    if (!resident) {
      throw new UnprocessableError(
        `Flat ${unit.flat_number} has no active occupant on record, so there is nobody to approve this visitor.`,
      );
    }

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

  // ── RESIDENT: requests waiting on me ─────────────────────────────────────────
  // Anyone living in the flat may answer, not only the person the visitor was
  // logged against — a walk-in is assigned to the owner, who may not be home.
  async getMyVisitorRequests(associationId: string, userId: string) {
    const me = await prisma.user.findFirst({
      where:  { id: userId, association_id: associationId },
      select: { unit_id: true },
    });
    if (!me?.unit_id) return { data: { pending: [], recent: [] } };

    const select = {
      id: true, visitor_name: true, visitor_phone: true, purpose: true,
      visit_type: true, status: true, vehicle_number: true,
      expected_at: true, entered_at: true, exited_at: true, created_at: true,
      unit: { select: { flat_number: true, block: true } },
    };

    const [pending, recent] = await Promise.all([
      prisma.visitor.findMany({
        where:   { association_id: associationId, unit_id: me.unit_id, status: VisitorStatus.PENDING },
        select,
        orderBy: { created_at: 'desc' },
        take:    20,
      }),
      // Recently decided, so the resident can see what happened after they tapped.
      prisma.visitor.findMany({
        where: {
          association_id: associationId,
          unit_id:        me.unit_id,
          status:         { in: [VisitorStatus.APPROVED, VisitorStatus.DENIED, VisitorStatus.ENTERED, VisitorStatus.EXITED] },
        },
        select,
        orderBy: { created_at: 'desc' },
        take:    15,
      }),
    ]);

    return { data: { pending, recent } };
  }

  async approveVisitor(associationId: string, visitorId: string, residentId: string, decision: 'APPROVED' | 'DENIED') {
    const visitor = await prisma.visitor.findFirst({ where: { id: visitorId, association_id: associationId } });
    if (!visitor) throw new NotFoundError('Visitor');

    // Any active occupant of the flat may decide, not just the one the visitor
    // happened to be logged against. Requiring an exact match meant a visitor
    // for a shared flat could only be approved by whoever was listed as owner.
    const decider = await prisma.user.findFirst({
      where:  { id: residentId, association_id: associationId, is_active: true, deleted_at: null },
      select: { unit_id: true },
    });
    if (!decider || decider.unit_id !== visitor.unit_id) throw new ForbiddenError();

    if (visitor.status !== VisitorStatus.PENDING) {
      throw new UnprocessableError(
        `This visitor has already been ${visitor.status.toLowerCase()}.`,
      );
    }

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

    // Only someone who actually came in can go out. Without this, a pending or
    // denied visitor could be marked EXITED, and the inside-now count — which
    // the guard relies on — would drift.
    if (visitor.status !== VisitorStatus.ENTERED) {
      throw new UnprocessableError(
        `${visitor.visitor_name} is not currently inside (status: ${visitor.status}).`,
      );
    }

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

  // ── PHOTO: capture at the gate ───────────────────────────────────────────────
  // One photo per visitor, replaced if taken again. Images only — a guard has
  // no reason to attach anything else, and this keeps the download endpoint
  // from becoming a general file host.
  async attachPhoto(
    associationId: string,
    visitorId: string,
    file: { buffer: Buffer; mimetype: string },
  ) {
    const visitor = await prisma.visitor.findFirst({
      where:  { id: visitorId, association_id: associationId },
      select: { id: true, visitor_name: true },
    });
    if (!visitor) throw new NotFoundError('Visitor');

    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!ALLOWED.includes(file.mimetype)) {
      throw new UnprocessableError(`${file.mimetype} is not an image. Capture a photo instead.`);
    }

    await prisma.visitor.update({
      where: { id: visitorId },
      data:  {
        photo_data:        file.buffer,
        photo_mime:        file.mimetype,
        photo_captured_at: new Date(),
      },
    });

    return { data: { visitor_id: visitorId, size: file.buffer.length } };
  }

  async getPhoto(associationId: string, visitorId: string) {
    const visitor = await prisma.visitor.findFirst({
      where:  { id: visitorId, association_id: associationId },
      select: { photo_data: true, photo_mime: true, visitor_name: true },
    });
    if (!visitor)            throw new NotFoundError('Visitor');
    if (!visitor.photo_data) throw new NotFoundError('No photo was taken for this visitor.');
    return visitor;
  }

  // ── DELIVERY: log a parcel ───────────────────────────────────────────────────
  // Deliveries do not wait for approval — nobody approves their food arriving.
  // The courier's own status reflects whether they came inside:
  //   sent up   → ENTERED, and they are counted in "inside now" until they leave
  //   at gate   → EXITED, because they never crossed into the premises
  // The parcel itself is tracked by delivery_status, which outlives the courier.
  async logDelivery(associationId: string, staffId: string, body: {
    unit_id: string; provider: string; courier_name?: string;
    courier_phone?: string; handling: 'AT_GATE' | 'SENT_UP'; note?: string;
  }) {
    const unit = await prisma.unit.findFirst({
      where:  { id: body.unit_id, association_id: associationId, deleted_at: null },
      select: { id: true, flat_number: true },
    });
    if (!unit) throw new NotFoundError('Unit');

    const resident = await prisma.user.findFirst({
      where:   { unit_id: body.unit_id, is_active: true, deleted_at: null },
      orderBy: [{ is_owner: 'desc' }, { created_at: 'asc' }],
      select:  { id: true },
    });
    if (!resident) {
      throw new UnprocessableError(
        `Flat ${unit.flat_number} has no active occupant on record, so there is nobody to notify.`,
      );
    }

    const sentUp = body.handling === 'SENT_UP';
    const now    = new Date();

    const visitor = await prisma.visitor.create({
      data: {
        association_id:    associationId,
        unit_id:           body.unit_id,
        resident_id:       resident.id,
        visitor_name:      body.courier_name?.trim() || body.provider,
        visitor_phone:     body.courier_phone,
        purpose:           body.note || `Delivery — ${body.provider}`,
        visit_type:        VisitType.DELIVERY,
        // No PENDING state: a delivery is never held for approval.
        status:            sentUp ? VisitorStatus.ENTERED : VisitorStatus.EXITED,
        entered_at:        sentUp ? now : null,
        exited_at:         sentUp ? null : now,
        delivery_status:   sentUp ? DeliveryStatus.SENT_UP : DeliveryStatus.AT_GATE,
        delivery_provider: body.provider,
        logged_by:         staffId,
      },
    });

    await notificationService.dispatch({
      type:       'VISITOR_WALKIN',
      channels:   ['PUSH'],
      recipients: [resident.id],
      data: {
        visitor_id:   visitor.id,
        visitor_name: body.provider,
        message: sentUp
          ? `${body.provider} delivery on its way up to flat ${unit.flat_number}.`
          : `${body.provider} parcel is waiting at the gate for flat ${unit.flat_number}.`,
      },
    });

    return { data: visitor };
  }

  // ── DELIVERY: parcel handed over ─────────────────────────────────────────────
  async markDeliveryCollected(associationId: string, visitorId: string) {
    const visitor = await prisma.visitor.findFirst({
      where:  { id: visitorId, association_id: associationId },
      select: { id: true, visitor_name: true, delivery_status: true, visit_type: true },
    });
    if (!visitor) throw new NotFoundError('Visitor');
    if (visitor.visit_type !== VisitType.DELIVERY) {
      throw new UnprocessableError('This is not a delivery.');
    }
    if (visitor.delivery_status !== DeliveryStatus.AT_GATE) {
      throw new UnprocessableError(
        `That parcel is already marked ${visitor.delivery_status ?? 'unknown'}.`,
      );
    }

    await prisma.visitor.update({
      where: { id: visitorId },
      data:  { delivery_status: DeliveryStatus.COLLECTED, collected_at: new Date() },
    });

    return { data: { message: 'Parcel collected' } };
  }

  // ── GATE: flat directory ─────────────────────────────────────────────────────
  // The console needs to offer a searchable list of flats. Gate staff cannot
  // read /users/units (manager-only, and it exposes resident contact details),
  // so this returns only what a guard legitimately needs: the flat and who to
  // announce the visitor to. No phone numbers, no email.
  async getGateUnits(associationId: string) {
    const units = await prisma.unit.findMany({
      where:  { association_id: associationId, deleted_at: null },
      select: {
        id: true, flat_number: true, block: true, floor: true,
        users: {
          where:  { is_active: true, deleted_at: null },
          select: { id: true, name: true, is_owner: true, role: true },
          orderBy: [{ is_owner: 'desc' }, { created_at: 'asc' }],
        },
      },
      orderBy: [{ block: 'asc' }, { flat_number: 'asc' }],
    });

    return {
      data: units.map(u => ({
        id:           u.id,
        flat_number:  u.flat_number,
        block:        u.block,
        floor:        u.floor,
        // Who the guard announces to. Owner first, else the longest-standing member.
        primary_contact: u.users[0]?.name ?? null,
        occupant_count:  u.users.length,
      })),
    };
  }

  // ── GATE: live board ─────────────────────────────────────────────────────────
  // Everything the console shows, in one call so it can poll cheaply:
  // who is waiting on a resident, who is cleared to walk in, and who is inside.
  async getGateBoard(associationId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Only the fields the console renders. Written out per query rather than
    // shared, because Prisma infers the row type from the literal.
    const [awaiting, approved, inside, parcels, todayCount] = await Promise.all([
      // Waiting on the resident to say yes.
      prisma.visitor.findMany({
        where:   { association_id: associationId, status: VisitorStatus.PENDING },
        select: {
          id: true, visitor_name: true, visitor_phone: true, purpose: true,
          visit_type: true, status: true, vehicle_number: true,
          expected_at: true, entered_at: true, created_at: true,
          unit: { select: { flat_number: true, block: true } },
        },
        orderBy: { created_at: 'asc' },
        take:    50,
      }),
      // Cleared, but not yet through the gate — includes pre-approvals.
      prisma.visitor.findMany({
        where:   { association_id: associationId, status: VisitorStatus.APPROVED },
        select: {
          id: true, visitor_name: true, visitor_phone: true, purpose: true,
          visit_type: true, status: true, vehicle_number: true,
          expected_at: true, entered_at: true, created_at: true,
          unit: { select: { flat_number: true, block: true } },
        },
        orderBy: { expected_at: 'asc' },
        take:    50,
      }),
      // Physically on the premises right now.
      prisma.visitor.findMany({
        where:   { association_id: associationId, status: VisitorStatus.ENTERED },
        select: {
          id: true, visitor_name: true, visitor_phone: true, purpose: true,
          visit_type: true, status: true, vehicle_number: true,
          expected_at: true, entered_at: true, created_at: true,
          unit: { select: { flat_number: true, block: true } },
        },
        orderBy: { entered_at: 'asc' },
        take:    100,
      }),
      // Parcels still sitting at the gate, oldest first — those are the ones
      // the guard is most likely to be asked about.
      prisma.visitor.findMany({
        where: {
          association_id:  associationId,
          visit_type:      VisitType.DELIVERY,
          delivery_status: DeliveryStatus.AT_GATE,
        },
        select: {
          id: true, visitor_name: true, visitor_phone: true, purpose: true,
          visit_type: true, status: true, vehicle_number: true,
          expected_at: true, entered_at: true, created_at: true,
          delivery_provider: true, delivery_status: true,
          unit: { select: { flat_number: true, block: true } },
        },
        orderBy: { created_at: 'asc' },
        take:    100,
      }),
      prisma.visitor.count({
        where: { association_id: associationId, created_at: { gte: startOfDay } },
      }),
    ]);

    // An entry still open well after it started is worth the guard's attention —
    // usually someone left without being checked out.
    const OVERSTAY_HOURS = 12;
    const cutoff = new Date(Date.now() - OVERSTAY_HOURS * 3600_000);

    return {
      data: {
        awaiting,
        approved,
        inside: inside.map(v => ({
          ...v,
          overstaying: v.entered_at ? v.entered_at < cutoff : false,
        })),
        parcels,
        counts: {
          awaiting:    awaiting.length,
          approved:    approved.length,
          inside:      inside.length,
          today:       todayCount,
          overstaying: inside.filter(v => v.entered_at && v.entered_at < cutoff).length,
          parcels:     parcels.length,
        },
      },
    };
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
