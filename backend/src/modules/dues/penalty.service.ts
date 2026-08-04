import { BillStatus, PenaltyType, Prisma, UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../utils/errors';
import { journalService } from '../accounting/journal.service';

/**
 * Late-payment penalties.
 *
 * Three rules, chosen deliberately:
 *
 *  1. ONCE PER BILL. A bill that runs past its due date plus the grace period
 *     attracts one penalty, ever. Not interest that compounds each month —
 *     that turns a ₹2,500 maintenance bill into a number nobody can explain at
 *     an AGM, and it is the mechanism by which small arrears become
 *     unrecoverable ones. Enforced by a partial unique index, not by trust.
 *
 *  2. NOTHING IS CHARGED WITHOUT A HUMAN. `preview()` computes and charges
 *     nothing; `apply()` charges only the bills it is handed. A wrong
 *     `penalty_value` should cost a treasurer a second look, not an apology to
 *     every flat in the block.
 *
 *  3. A WAIVER REVERSES, IT DOES NOT ERASE. The charge and its reversal both
 *     stay on the ledger and both stay on the statement. Deleting the row
 *     would leave the committee unable to answer "did we ever penalise them,
 *     and who let them off?" — the question that actually gets asked.
 */

export interface PenaltyConfig {
  penalty_type:  PenaltyType;
  penalty_value: number;
  grace_days:    number;
}

export interface PenaltyCandidate {
  bill_id:      string;
  unit_id:      string;
  flat_number:  string;
  block:        string | null;
  resident:     string | null;
  period:       string;
  due_date:     string;
  days_overdue: number;
  bill_amount:  number;
  outstanding:  number;
  penalty:      number;
}

const num = (d: unknown) => Number(d ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

/** Whole days from `due` to `asOf`. Negative means not yet due. */
export function daysOverdue(due: Date, asOf: Date): number {
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return Math.floor((b - a) / 86_400_000);
}

/**
 * The amount, given the bill and the config. Pure — no database, no clock —
 * so the arithmetic can be tested directly.
 *
 * Returns 0 when no penalty is owed, which callers treat as "not eligible".
 */
export function penaltyFor(
  bill: { total_amount: number; due_date: Date },
  cfg:  PenaltyConfig,
  asOf: Date,
): { amount: number; days_overdue: number } {
  const overdue = daysOverdue(bill.due_date, asOf);
  if (overdue <= cfg.grace_days) return { amount: 0, days_overdue: overdue };
  if (cfg.penalty_value <= 0)    return { amount: 0, days_overdue: overdue };

  const amount = cfg.penalty_type === PenaltyType.FLAT
    ? cfg.penalty_value
    // Percentage is taken on the bill's own amount, not on the running
    // balance. The penalty for being late with August's bill should not change
    // because July is also unpaid — that is compounding through the back door.
    : (bill.total_amount * cfg.penalty_value) / 100;

  return { amount: round2(amount), days_overdue: overdue };
}

export class PenaltyService {

  private async config(associationId: string): Promise<PenaltyConfig> {
    const cfg = await prisma.duesConfig.findUnique({
      where:  { association_id: associationId },
      select: { penalty_type: true, penalty_value: true, penalty_grace_days: true },
    });
    if (!cfg) {
      throw new UnprocessableError(
        'Set up the fee configuration before charging penalties.'
      );
    }
    return {
      penalty_type:  cfg.penalty_type,
      penalty_value: num(cfg.penalty_value),
      grace_days:    cfg.penalty_grace_days,
    };
  }

  /**
   * Every bill that would be penalised if the run were applied right now.
   * Charges nothing.
   */
  async preview(associationId: string, asOfStr?: string) {
    const asOf = asOfStr ? new Date(asOfStr) : new Date();
    if (Number.isNaN(asOf.getTime())) throw new UnprocessableError('Invalid date.');

    const cfg = await this.config(associationId);

    const bills = await prisma.bill.findMany({
      where: {
        association_id: associationId,
        status: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] },
        due_date: { lt: asOf },
        // Bills that already carry a live penalty are out. A waived one is
        // back in — the committee can change its mind, and that is a decision
        // they are allowed to make twice.
        penalties: { none: { waived_at: null } },
        unit: { deleted_at: null },
      },
      select: {
        id: true, unit_id: true, due_date: true, total_amount: true,
        period_month: true, period_year: true, bill_label: true,
        unit: {
          select: {
            flat_number: true, block: true,
            users: {
              where:  { is_active: true, deleted_at: null },
              select: { name: true },
              orderBy: [{ is_owner: 'desc' }, { created_at: 'asc' }],
              take: 1,
            },
          },
        },
        payments: { select: { amount: true } },
      },
      orderBy: [{ due_date: 'asc' }],
    });

    const candidates: PenaltyCandidate[] = [];
    for (const b of bills) {
      const total = num(b.total_amount);
      const { amount, days_overdue } = penaltyFor(
        { total_amount: total, due_date: b.due_date }, cfg, asOf,
      );
      if (amount <= 0) continue;

      const paid = b.payments.reduce((s, p) => s + num(p.amount), 0);
      const outstanding = round2(total - paid);
      // A bill marked PARTIAL but paid to the last rupee is settled in
      // substance; penalising it would be indefensible.
      if (outstanding <= 0) continue;

      candidates.push({
        bill_id:     b.id,
        unit_id:     b.unit_id,
        flat_number: b.unit.flat_number,
        block:       b.unit.block,
        resident:    b.unit.users[0]?.name ?? null,
        period:      b.bill_label
                       ?? `${MONTHS[b.period_month - 1] ?? b.period_month} ${b.period_year}`,
        due_date:    iso(b.due_date),
        days_overdue,
        bill_amount: total,
        outstanding,
        penalty:     amount,
      });
    }

    return {
      data: candidates,
      config: cfg,
      as_of: iso(asOf),
      totals: {
        flats:   new Set(candidates.map(c => c.unit_id)).size,
        bills:   candidates.length,
        penalty: round2(candidates.reduce((s, c) => s + c.penalty, 0)),
      },
    };
  }

  /**
   * Charge the given bills. Anything not listed is left alone, so the review
   * screen's exclusions are honoured by omission rather than by a flag.
   *
   * Each bill is its own transaction: one flat missing a business partner card
   * should not abandon the other ninety. The failures come back named so they
   * can be fixed and re-run.
   */
  async apply(
    associationId: string,
    userId:        string,
    billIds:       string[],
    asOfStr?:      string,
  ) {
    if (!billIds.length) throw new UnprocessableError('No bills were selected.');

    const asOf = asOfStr ? new Date(asOfStr) : new Date();
    if (Number.isNaN(asOf.getTime())) throw new UnprocessableError('Invalid date.');

    const cfg = await this.config(associationId);

    const bills = await prisma.bill.findMany({
      where:  { id: { in: billIds }, association_id: associationId },
      select: {
        id: true, unit_id: true, due_date: true, total_amount: true, penalty: true,
        status: true, period_month: true, period_year: true, bill_label: true,
        unit: { select: { flat_number: true } },
      },
    });

    const charged: Array<{ bill_id: string; flat_number: string; amount: number }> = [];
    const skipped: Array<{ bill_id: string; flat_number: string; reason: string }> = [];

    for (const b of bills) {
      const flat = b.unit.flat_number;

      if (b.status === BillStatus.PAID) {
        skipped.push({ bill_id: b.id, flat_number: flat, reason: 'Already paid in full' });
        continue;
      }

      const { amount, days_overdue } = penaltyFor(
        { total_amount: num(b.total_amount), due_date: b.due_date }, cfg, asOf,
      );
      if (amount <= 0) {
        skipped.push({ bill_id: b.id, flat_number: flat, reason: 'Within the grace period' });
        continue;
      }

      const label = b.bill_label
        ?? `${MONTHS[b.period_month - 1] ?? b.period_month} ${b.period_year}`;

      try {
        await prisma.$transaction(async (tx) => {
          const penalty = await tx.billPenalty.create({
            data: {
              association_id: associationId,
              bill_id:        b.id,
              amount,
              penalty_type:   cfg.penalty_type,
              penalty_value:  cfg.penalty_value,
              grace_days:     cfg.grace_days,
              days_overdue,
              charged_on:     asOf,
              charged_by:     userId,
            },
          });

          // bills.penalty and bills.total_amount are the denormalised live
          // figures every other screen reads. They move with the charge or the
          // statement and the bill disagree.
          await tx.bill.update({
            where: { id: b.id },
            data: {
              penalty:      { increment: amount },
              total_amount: { increment: amount },
            },
          });

          await journalService.postPenaltyCharged(
            associationId, penalty.id, b.unit_id, amount,
            `Late payment penalty — Flat ${flat}, ${label} (${days_overdue} days overdue)`,
            asOf, userId, tx,
          );
        });

        charged.push({ bill_id: b.id, flat_number: flat, amount });
      } catch (err) {
        // The unique index is the expected failure here: someone else applied
        // the same run a moment earlier. Say so plainly rather than as a
        // constraint name.
        const already = err instanceof Prisma.PrismaClientKnownRequestError
                     && err.code === 'P2002';
        skipped.push({
          bill_id: b.id, flat_number: flat,
          reason: already
            ? 'A penalty is already live on this bill'
            : err instanceof Error ? err.message : 'Could not be charged',
        });
      }
    }

    return {
      charged,
      skipped,
      totals: { charged: charged.length, skipped: skipped.length,
                amount: round2(charged.reduce((s, c) => s + c.amount, 0)) },
    };
  }

  /** Penalties on one flat, newest first — charged and waived alike. */
  async history(associationId: string, unitId: string) {
    const rows = await prisma.billPenalty.findMany({
      where: { association_id: associationId, bill: { unit_id: unitId } },
      select: {
        id: true, amount: true, days_overdue: true, charged_on: true,
        waived_at: true, waive_reason: true,
        penalty_type: true, penalty_value: true, grace_days: true,
        charger: { select: { name: true } },
        waiver:  { select: { name: true } },
        bill: {
          select: {
            id: true, period_month: true, period_year: true,
            bill_label: true, due_date: true,
          },
        },
      },
      orderBy: { charged_on: 'desc' },
    });

    return {
      data: rows.map(r => ({
        id:           r.id,
        bill_id:      r.bill.id,
        period:       r.bill.bill_label
                        ?? `${MONTHS[r.bill.period_month - 1] ?? r.bill.period_month} ${r.bill.period_year}`,
        due_date:     iso(r.bill.due_date),
        amount:       num(r.amount),
        days_overdue: r.days_overdue,
        charged_on:   iso(r.charged_on),
        charged_by:   r.charger.name,
        basis:        r.penalty_type === PenaltyType.FLAT
                        ? `₹${num(r.penalty_value).toFixed(2)} flat, after ${r.grace_days} days' grace`
                        : `${num(r.penalty_value)}% of the bill, after ${r.grace_days} days' grace`,
        waived:       r.waived_at !== null,
        waived_on:    r.waived_at ? iso(r.waived_at) : null,
        waived_by:    r.waiver?.name ?? null,
        waive_reason: r.waive_reason,
      })),
    };
  }

  /**
   * Reverse a penalty in full.
   *
   * Deliberately narrow: no partial amounts, and the reason is required. A
   * partial waiver is a negotiation, and a negotiation belongs in a committee
   * minute with a full waiver against it — not in a free-text amount box that
   * nobody can reconcile two years later.
   */
  async waive(
    associationId: string,
    userId:        string,
    userRole:      UserRole,
    penaltyId:     string,
    reason:        string,
  ) {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < 5) {
      throw new UnprocessableError(
        'Give a reason for the waiver — it is the only record of why this was let off.'
      );
    }

    // Waiving is forgiving association income, so it sits with the treasurer
    // and the manager rather than with everyone who can see the screen.
    const allowed: UserRole[] = [UserRole.TREASURER, UserRole.MANAGER, UserRole.SUPER_USER];
    if (!allowed.includes(userRole)) {
      throw new ForbiddenError('Only a treasurer or manager can waive a penalty.');
    }

    const penalty = await prisma.billPenalty.findFirst({
      where:  { id: penaltyId, association_id: associationId },
      select: {
        id: true, amount: true, waived_at: true,
        bill: {
          select: {
            id: true, unit_id: true, penalty: true, total_amount: true,
            period_month: true, period_year: true, bill_label: true,
            unit: { select: { flat_number: true } },
          },
        },
      },
    });
    if (!penalty) throw new NotFoundError('Penalty');
    if (penalty.waived_at) throw new UnprocessableError('This penalty has already been waived.');

    const amount = num(penalty.amount);
    const flat   = penalty.bill.unit.flat_number;
    const label  = penalty.bill.bill_label
      ?? `${MONTHS[penalty.bill.period_month - 1] ?? penalty.bill.period_month} ${penalty.bill.period_year}`;
    const now    = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.billPenalty.update({
        where: { id: penalty.id },
        data:  { waived_at: now, waived_by: userId, waive_reason: trimmed },
      });

      await tx.bill.update({
        where: { id: penalty.bill.id },
        data: {
          penalty:      { decrement: amount },
          total_amount: { decrement: amount },
        },
      });

      await journalService.postPenaltyWaived(
        associationId, penalty.id, penalty.bill.unit_id, amount,
        `Penalty waived — Flat ${flat}, ${label}: ${trimmed}`,
        now, userId, tx,
      );
    });

    return { id: penalty.id, amount, waived_on: iso(now) };
  }
}

export const penaltyService = new PenaltyService();
