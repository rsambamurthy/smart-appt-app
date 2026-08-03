import prisma from '../../config/database';
import {
  ComplianceCategory, Recurrence, ComplianceStatus, UserRole, AuditAction,
} from '@prisma/client';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { auditService } from '../../services/audit.service';
import { notificationService } from '../../services/notification.service';
import logger from '../../utils/logger';

/**
 * The compliance calendar.
 *
 * An item is the obligation; an occurrence is one due date. Marking an
 * occurrence done keeps it on the record with its acknowledgement number —
 * "the return was filed on the 12th, receipt 4471" is the thing an auditor
 * asks for, and a single "done" flag on the item could not answer it.
 *
 * Occurrences for the next twelve months are generated up front so the year
 * ahead is visible, rather than one deadline appearing at a time.
 */

const MONTHS_AHEAD = 12;

const itemSelect = {
  id: true, title: true, description: true, category: true, recurrence: true,
  due_month: true, due_day: true, remind_days_before: true, is_active: true,
  owner: { select: { id: true, name: true } },
};

/** How many months between occurrences. NONE means a single date. */
const STEP: Record<Recurrence, number> = {
  NONE: 0, MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, ANNUAL: 12,
};

/**
 * Due dates for the next year.
 *
 * Clamped to the end of the month, so "the 31st" in a 30-day month lands on
 * the 30th rather than rolling into the next month — which would silently move
 * a deadline past where someone set it.
 */
export function dueDates(
  recurrence: Recurrence, dueMonth: number | null, dueDay: number, from = new Date(),
): Date[] {
  const step = STEP[recurrence];
  const clamp = (y: number, m: number, d: number) => {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d, last)));
  };

  if (step === 0) {
    const m = (dueMonth ?? from.getUTCMonth() + 1) - 1;
    return [clamp(from.getUTCFullYear(), m, dueDay)];
  }

  const out: Date[] = [];
  const horizon = new Date(from);
  horizon.setUTCMonth(horizon.getUTCMonth() + MONTHS_AHEAD);

  // Start from the anchor month in the current year and walk forward. Going
  // back one cycle first catches a date that has just passed, so it appears as
  // overdue rather than vanishing until next year.
  const anchor = (dueMonth ?? 1) - 1;
  let y = from.getUTCFullYear();
  let m = anchor;
  while (clamp(y, m, dueDay) > from) { m -= step; if (m < 0) { m += 12; y -= 1; } }

  for (let guard = 0; guard < 40; guard++) {
    const d = clamp(y, m, dueDay);
    if (d > horizon) break;
    if (d >= new Date(from.getTime() - 400 * 86_400_000)) out.push(d);
    m += step;
    while (m > 11) { m -= 12; y += 1; }
  }

  return out;
}

export class ComplianceService {

  /** The calendar: every occurrence in view, with its item. */
  async list(associationId: string, opts: { openOnly?: boolean } = {}) {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Top up the schedule if there is nothing ahead.
    //
    // Items can exist with no due dates: the starter list is inserted by a
    // migration, which cannot call this code. The same happens once a year of
    // generated dates has been worked through. Rather than leave an empty
    // calendar under a note about starter items — which is exactly what it did
    // the first time — fill it in on read. generate() is idempotent, so this
    // costs one count in the normal case.
    const upcoming = await prisma.complianceOccurrence.count({
      where: {
        association_id: associationId,
        status: ComplianceStatus.PENDING,
        due_on: { gte: today },
      },
    });
    if (upcoming === 0) await this.generateAll(associationId);

    const occurrences = await prisma.complianceOccurrence.findMany({
      where: {
        association_id: associationId,
        item: { is_active: true },
        ...(opts.openOnly ? { status: ComplianceStatus.PENDING } : {}),
      },
      select: {
        id: true, due_on: true, status: true, completed_on: true,
        reference: true, notes: true,
        completed_by: { select: { name: true } },
        item: { select: itemSelect },
      },
      orderBy: { due_on: 'asc' },
      take: 200,
    });

    const rows = occurrences.map(o => ({
      ...o,
      // Overdue is derived, never stored. A stored flag is wrong from the
      // moment midnight passes with nobody looking.
      overdue: o.status === ComplianceStatus.PENDING && o.due_on < today,
      days_until: Math.ceil((o.due_on.getTime() - today.getTime()) / 86_400_000),
    }));

    return {
      data: rows,
      summary: {
        overdue: rows.filter(r => r.overdue).length,
        due_soon: rows.filter(r => !r.overdue && r.status === 'PENDING' && r.days_until <= 30).length,
        open: rows.filter(r => r.status === 'PENDING').length,
      },
    };
  }

  /**
   * The obligations, each with its next due date and whether it is late.
   *
   * This is the list people actually work from: an obligation is the thing you
   * own and reschedule; a due date is just when it next falls.
   */
  async listItemsWithStatus(associationId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Fill the schedule if nothing is ahead — the starter list arrives from a
    // migration, which cannot call this code.
    const upcoming = await prisma.complianceOccurrence.count({
      where: { association_id: associationId, status: ComplianceStatus.PENDING, due_on: { gte: today } },
    });
    if (upcoming === 0) await this.generateAll(associationId);

    const items = await prisma.complianceItem.findMany({
      where:  { association_id: associationId },
      select: {
        ...itemSelect,
        occurrences: {
          where:   { status: ComplianceStatus.PENDING },
          select:  { id: true, due_on: true },
          orderBy: { due_on: 'asc' },
          take:    1,
        },
        _count: { select: { occurrences: { where: { status: ComplianceStatus.DONE } } } },
      },
      orderBy: [{ is_active: 'desc' }, { title: 'asc' }],
    });

    const rows = items.map(i => {
      const next = i.occurrences[0] ?? null;
      const days = next
        ? Math.ceil((next.due_on.getTime() - today.getTime()) / 86_400_000)
        : null;
      return {
        ...i,
        occurrences: undefined,
        next_due_on:   next?.due_on ?? null,
        next_id:       next?.id ?? null,
        days_until:    days,
        overdue:       days !== null && days < 0,
        completed_count: i._count.occurrences,
      };
    });

    return {
      data: rows,
      summary: {
        overdue:  rows.filter(r => r.overdue && r.is_active).length,
        due_soon: rows.filter(r => !r.overdue && r.is_active && r.days_until !== null && r.days_until <= 30).length,
        total:    rows.filter(r => r.is_active).length,
      },
    };
  }

  /** One obligation, with every due date it has had. */
  async getItem(associationId: string, itemId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const item = await prisma.complianceItem.findFirst({
      where:  { id: itemId, association_id: associationId },
      select: {
        ...itemSelect,
        occurrences: {
          select: {
            id: true, due_on: true, status: true, completed_on: true,
            reference: true, notes: true,
            completed_by: { select: { name: true } },
          },
          orderBy: { due_on: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundError('Compliance item');

    return {
      data: {
        ...item,
        occurrences: item.occurrences.map(o => ({
          ...o,
          overdue: o.status === ComplianceStatus.PENDING && o.due_on < today,
          days_until: Math.ceil((o.due_on.getTime() - today.getTime()) / 86_400_000),
        })),
      },
    };
  }

  async listItems(associationId: string) {
    return { data: await prisma.complianceItem.findMany({
      where:   { association_id: associationId },
      select:  itemSelect,
      orderBy: [{ is_active: 'desc' }, { title: 'asc' }],
    }) };
  }

  async createItem(associationId: string, userId: string, body: {
    title: string; description?: string;
    category?: ComplianceCategory; recurrence?: Recurrence;
    due_month?: number | null; due_day?: number;
    owner_user_id?: string | null; remind_days_before?: number;
  }) {
    if (!body.title?.trim()) throw new UnprocessableError('Give the obligation a name.');

    const item = await prisma.complianceItem.create({
      data: {
        association_id: associationId,
        title:       body.title.trim(),
        description: body.description?.trim() || null,
        category:    body.category ?? ComplianceCategory.OTHER,
        recurrence:  body.recurrence ?? Recurrence.ANNUAL,
        due_month:   body.due_month ?? null,
        due_day:     body.due_day ?? 1,
        owner_user_id:      body.owner_user_id || null,
        remind_days_before: body.remind_days_before ?? 14,
      },
      select: itemSelect,
    });

    await this.generate(associationId, item.id);

    await auditService.record({
      entity_type: 'compliance', entity_id: item.id, action: AuditAction.CREATE,
      association_id: associationId, performed_by: userId,
      summary: `Compliance item added: ${item.title}`,
    });

    return { data: item };
  }

  async updateItem(associationId: string, itemId: string, body: Record<string, unknown>) {
    const item = await prisma.complianceItem.findFirst({
      where: { id: itemId, association_id: associationId }, select: { id: true },
    });
    if (!item) throw new NotFoundError('Compliance item');

    const updated = await prisma.complianceItem.update({
      where: { id: itemId },
      data: {
        ...(body['title']       !== undefined && { title: String(body['title']).trim() }),
        ...(body['description'] !== undefined && { description: (body['description'] as string)?.trim() || null }),
        ...(body['category']    !== undefined && { category: body['category'] as ComplianceCategory }),
        ...(body['recurrence']  !== undefined && { recurrence: body['recurrence'] as Recurrence }),
        ...(body['due_month']   !== undefined && { due_month: body['due_month'] as number | null }),
        ...(body['due_day']     !== undefined && { due_day: body['due_day'] as number }),
        ...(body['owner_user_id'] !== undefined && { owner_user_id: (body['owner_user_id'] as string) || null }),
        ...(body['remind_days_before'] !== undefined && { remind_days_before: body['remind_days_before'] as number }),
        ...(body['is_active']   !== undefined && { is_active: body['is_active'] as boolean }),
      },
      select: itemSelect,
    });

    // The schedule may have moved. Future PENDING occurrences are rebuilt;
    // anything already done or past is left alone, because history is not a
    // function of today's settings.
    await this.generate(associationId, itemId, true);

    return { data: updated };
  }

  /**
   * Create the occurrences for an item.
   *
   * Idempotent: the unique index on (item_id, due_on) means running it again
   * adds only what is missing, so it is safe to call on every edit and from a
   * scheduled job.
   */
  async generate(associationId: string, itemId: string, clearFuture = false) {
    const item = await prisma.complianceItem.findFirst({
      where:  { id: itemId, association_id: associationId },
      select: { id: true, recurrence: true, due_month: true, due_day: true, is_active: true },
    });
    if (!item || !item.is_active) return;

    if (clearFuture) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      await prisma.complianceOccurrence.deleteMany({
        where: { item_id: itemId, status: ComplianceStatus.PENDING, due_on: { gt: today } },
      });
    }

    const dates = dueDates(item.recurrence, item.due_month, item.due_day);

    await prisma.complianceOccurrence.createMany({
      data: dates.map(due_on => ({ item_id: itemId, association_id: associationId, due_on })),
      skipDuplicates: true,
    });
  }

  /** Fill in missing due dates for every active item. Safe to run repeatedly. */
  async generateAll(associationId: string) {
    const items = await prisma.complianceItem.findMany({
      where: { association_id: associationId, is_active: true }, select: { id: true },
    });

    const before = await prisma.complianceOccurrence.count({ where: { association_id: associationId } });
    for (const i of items) await this.generate(associationId, i.id);
    const after = await prisma.complianceOccurrence.count({ where: { association_id: associationId } });

    return { data: { items: items.length, created: after - before } };
  }

  async complete(associationId: string, occurrenceId: string, userId: string, body: {
    completed_on?: string; reference?: string; notes?: string; waived?: boolean;
  }) {
    const occ = await prisma.complianceOccurrence.findFirst({
      where:  { id: occurrenceId, association_id: associationId },
      select: { id: true, item: { select: { title: true } } },
    });
    if (!occ) throw new NotFoundError('Compliance occurrence');

    const on = body.completed_on ? new Date(body.completed_on) : new Date();
    if (Number.isNaN(on.getTime())) throw new UnprocessableError('Invalid completion date.');

    const updated = await prisma.complianceOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status:          body.waived ? ComplianceStatus.WAIVED : ComplianceStatus.DONE,
        completed_on:    on,
        completed_by_id: userId,
        reference:       body.reference?.trim() || null,
        notes:           body.notes?.trim() || null,
      },
    });

    await auditService.record({
      entity_type: 'compliance', entity_id: occurrenceId, action: AuditAction.CLOSE,
      association_id: associationId, performed_by: userId,
      summary: `${occ.item.title} marked ${body.waived ? 'not applicable' : 'done'}` +
               (body.reference ? ` — ${body.reference.trim()}` : ''),
    });

    return { data: updated };
  }

  /** Undo. Mistakes happen, and a wrongly closed obligation is a real risk. */
  async reopen(associationId: string, occurrenceId: string, userId: string) {
    const occ = await prisma.complianceOccurrence.findFirst({
      where: { id: occurrenceId, association_id: associationId }, select: { id: true },
    });
    if (!occ) throw new NotFoundError('Compliance occurrence');

    await auditService.record({
      entity_type: 'compliance', entity_id: occurrenceId, action: AuditAction.REOPEN,
      association_id: associationId, performed_by: userId,
      summary: 'Compliance occurrence reopened',
    });

    return { data: await prisma.complianceOccurrence.update({
      where: { id: occurrenceId },
      data:  { status: ComplianceStatus.PENDING, completed_on: null, completed_by_id: null },
    }) };
  }

  /**
   * Reminders and escalation. Intended to run daily.
   *
   * Two stages: the owner is told once as the date approaches, and once it has
   * passed the whole committee is told — an overdue obligation stops being one
   * person's problem. `reminded_at` and `escalated_at` stop either being sent
   * twice.
   */
  async runReminders() {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const due = await prisma.complianceOccurrence.findMany({
      where:  { status: ComplianceStatus.PENDING, reminded_at: null },
      select: {
        id: true, due_on: true, association_id: true,
        item: { select: { title: true, remind_days_before: true, owner_user_id: true } },
      },
      take: 500,
    });

    for (const o of due) {
      const days = Math.ceil((o.due_on.getTime() - today.getTime()) / 86_400_000);
      if (days > o.item.remind_days_before || days < 0) continue;
      if (!o.item.owner_user_id) continue;

      try {
        await notificationService.dispatch({
          type: 'COMPLIANCE_DUE',
          channels: ['PUSH', 'EMAIL'],
          recipients: [o.item.owner_user_id],
          data: { title: o.item.title, due_on: o.due_on.toISOString().slice(0, 10), days },
        });
        await prisma.complianceOccurrence.update({
          where: { id: o.id }, data: { reminded_at: new Date() },
        });
      } catch (err) {
        logger.error('Compliance reminder failed', { id: o.id, error: (err as Error).message });
      }
    }

    const overdue = await prisma.complianceOccurrence.findMany({
      where:  { status: ComplianceStatus.PENDING, due_on: { lt: today }, escalated_at: null },
      select: { id: true, association_id: true, due_on: true, item: { select: { title: true } } },
      take: 200,
    });

    for (const o of overdue) {
      try {
        const committee = await prisma.user.findMany({
          where: {
            association_id: o.association_id,
            role: { in: [UserRole.MANAGER, UserRole.TREASURER, UserRole.COMMITTEE] },
            is_active: true, deleted_at: null,
          },
          select: { id: true },
        });
        if (committee.length === 0) continue;

        await notificationService.dispatch({
          type: 'COMPLIANCE_OVERDUE',
          channels: ['PUSH', 'EMAIL'],
          recipients: committee.map(c => c.id),
          data: { title: o.item.title, due_on: o.due_on.toISOString().slice(0, 10) },
        });
        await prisma.complianceOccurrence.update({
          where: { id: o.id }, data: { escalated_at: new Date() },
        });
      } catch (err) {
        logger.error('Compliance escalation failed', { id: o.id, error: (err as Error).message });
      }
    }

    return { reminded: due.length, escalated: overdue.length };
  }
}

export const complianceService = new ComplianceService();
