import prisma from '../../config/database';
import { NotFoundError, UnprocessableError } from '../../utils/errors';

/**
 * Statement of account for one flat.
 *
 * The answer to the single most-asked resident question: what do I owe, and
 * why. A balance on its own invites an argument; a dated running balance
 * showing every charge and every payment ends one.
 *
 * Built as a ledger, not a list of unpaid bills:
 *
 *   opening balance
 *   + charges raised in the period   (bill total, split into base/levy/penalty)
 *   − payments received in the period
 *   = closing balance
 *
 * A positive closing balance means the flat owes money.
 */

export interface StatementLine {
  date: string;
  kind: 'CHARGE' | 'PAYMENT';
  description: string;
  reference: string | null;
  /** Positive increases what the flat owes; negative reduces it. */
  amount: number;
  balance: number;
  /** Raised but not yet payable. Part of the balance, but not arrears. */
  not_yet_due?: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const num = (d: unknown) => Number(d ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export class StatementService {

  /**
   * @param from  inclusive; defaults to the start of the current financial year
   * @param to    inclusive; defaults to today
   */
  async forUnit(associationId: string, unitId: string, opts: { from?: string; to?: string } = {}) {
    const unit = await prisma.unit.findFirst({
      where:  { id: unitId, association_id: associationId, deleted_at: null },
      select: {
        id: true, flat_number: true, block: true,
        users: {
          where:  { is_active: true, deleted_at: null },
          select: { name: true, phone: true, is_owner: true },
          orderBy: [{ is_owner: 'desc' }, { created_at: 'asc' }],
          take: 1,
        },
      },
    });
    if (!unit) throw new NotFoundError('Unit');

    const cfg = await prisma.associationConfig.findUnique({
      where:  { association_id: associationId },
      select: { financial_year_start_month: true },
    });
    const fyStartMonth = cfg?.financial_year_start_month ?? 4;

    const to = opts.to ? new Date(opts.to) : new Date();
    if (Number.isNaN(to.getTime())) throw new UnprocessableError('Invalid end date.');
    // payment_date is a timestamp; a date-only bound parses to midnight and
    // would silently drop everything received later that day.
    to.setHours(23, 59, 59, 999);

    let from: Date;
    if (opts.from) {
      from = new Date(opts.from);
      if (Number.isNaN(from.getTime())) throw new UnprocessableError('Invalid start date.');
    } else {
      // Start of the financial year containing `to`.
      const y = to.getMonth() + 1 >= fyStartMonth ? to.getFullYear() : to.getFullYear() - 1;
      from = new Date(Date.UTC(y, fyStartMonth - 1, 1));
    }
    if (from > to) throw new UnprocessableError('The start date is after the end date.');

    // Bills are dated by their due date; a bill raised for April is April's
    // charge regardless of when the row happened to be created.
    //
    // But a bill is a charge from the moment it is raised, not from the moment
    // it falls due. Cutting bills off at `to` hid the current month's bill for
    // everyone looking before the due day — exactly the people about to pay it.
    // So bills run to the end of the month containing `to` while payments stop
    // at `to`, and anything not yet due is reported separately so it can be
    // told apart from arrears.
    const billCutoff = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59, 999);
    const today = new Date(); today.setHours(23, 59, 59, 999);

    const [billsBefore, paymentsBefore, bills, payments] = await Promise.all([
      prisma.bill.aggregate({
        where:  { unit_id: unitId, association_id: associationId, due_date: { lt: from } },
        _sum:   { total_amount: true },
      }),
      prisma.payment.aggregate({
        where:  { unit_id: unitId, association_id: associationId, payment_date: { lt: from } },
        _sum:   { amount: true },
      }),
      prisma.bill.findMany({
        where:  { unit_id: unitId, association_id: associationId, due_date: { gte: from, lte: billCutoff } },
        select: {
          id: true, due_date: true, period_month: true, period_year: true,
          base_amount: true, penalty: true, levy_amount: true, total_amount: true,
          bill_label: true, status: true,
        },
        orderBy: { due_date: 'asc' },
      }),
      prisma.payment.findMany({
        where:  { unit_id: unitId, association_id: associationId, payment_date: { gte: from, lte: to } },
        select: {
          id: true, payment_date: true, amount: true, payment_mode: true,
          reference_no: true, gateway_txn_id: true,
        },
        orderBy: { payment_date: 'asc' },
      }),
    ]);

    const opening = num(billsBefore._sum.total_amount) - num(paymentsBefore._sum.amount);

    // Merged and sorted by date so the running balance reads chronologically.
    // A charge and a payment on the same day put the charge first: you cannot
    // pay a bill before it exists.
    type Entry = { at: Date; order: number; line: Omit<StatementLine, 'balance'> };
    const entries: Entry[] = [];

    for (const b of bills) {
      const label = b.bill_label
        ?? `Maintenance — ${MONTHS[b.period_month - 1] ?? b.period_month} ${b.period_year}`;
      const parts: string[] = [];
      if (num(b.levy_amount)) parts.push(`levy ${num(b.levy_amount).toFixed(2)}`);
      if (num(b.penalty))     parts.push(`penalty ${num(b.penalty).toFixed(2)}`);

      entries.push({
        at: b.due_date, order: 0,
        line: {
          date: iso(b.due_date),
          kind: 'CHARGE',
          description: parts.length ? `${label} (incl. ${parts.join(', ')})` : label,
          reference: null,
          amount: num(b.total_amount),
          not_yet_due: b.due_date > today,
        },
      });
    }

    for (const p of payments) {
      entries.push({
        at: p.payment_date, order: 1,
        line: {
          date: iso(p.payment_date),
          kind: 'PAYMENT',
          description: `Payment received — ${p.payment_mode.toLowerCase().replace('_', ' ')}`,
          reference: p.reference_no ?? p.gateway_txn_id ?? null,
          amount: -num(p.amount),
        },
      });
    }

    entries.sort((a, b) =>
      a.at.getTime() - b.at.getTime() || a.order - b.order);

    let balance = opening;
    const lines: StatementLine[] = entries.map(e => {
      balance += e.line.amount;
      // Rounded at each step rather than only at the end: the running balance
      // is read line by line, and a column that does not add up destroys
      // confidence in the whole statement.
      balance = Math.round(balance * 100) / 100;
      return { ...e.line, balance };
    });

    const charged = bills.reduce((s, b) => s + num(b.total_amount), 0);
    const paid    = payments.reduce((s, p) => s + num(p.amount), 0);

    return {
      data: {
        unit: {
          id: unit.id,
          flat_number: unit.flat_number,
          block: unit.block,
          resident: unit.users[0]?.name ?? null,
          phone: unit.users[0]?.phone ?? null,
        },
        period: { from: iso(from), to: iso(to) },
        opening_balance: Math.round(opening * 100) / 100,
        charged: Math.round(charged * 100) / 100,
        paid:    Math.round(paid * 100) / 100,
        closing_balance: Math.round(balance * 100) / 100,
        // Of the closing balance, how much is not yet payable. A resident
        // seeing a figure they are not late on should be told so.
        not_yet_due: Math.round(bills.filter(b => b.due_date > today)
                        .reduce((s, b) => s + num(b.total_amount), 0) * 100) / 100,
        // Split out because a treasurer chasing arrears wants to know how much
        // of the balance is penalty rather than principal.
        penalty_charged: Math.round(bills.reduce((s, b) => s + num(b.penalty), 0) * 100) / 100,
        lines,
      },
    };
  }

  /** Every flat's closing balance — the arrears list, as at a date. */
  async summary(associationId: string, asOf?: string) {
    const to = asOf ? new Date(asOf) : new Date();
    if (Number.isNaN(to.getTime())) throw new UnprocessableError('Invalid date.');
    to.setHours(23, 59, 59, 999);

    const units = await prisma.unit.findMany({
      where:  { association_id: associationId, deleted_at: null },
      select: { id: true, flat_number: true, block: true },
      orderBy: [{ block: 'asc' }, { flat_number: 'asc' }],
    });

    // Bills run to the end of the month containing `to`, so the current
    // month's bill appears from the day it is raised rather than from its due
    // day. What is not yet payable is counted separately: a flat that owes
    // only this month's not-yet-due bill is not in arrears.
    const billCutoff = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59, 999);
    const today = new Date(); today.setHours(23, 59, 59, 999);

    // Grouped queries rather than one per flat: this screen is opened often.
    const [billed, paid, upcoming] = await Promise.all([
      prisma.bill.groupBy({
        by: ['unit_id'],
        where: { association_id: associationId, due_date: { lte: billCutoff } },
        _sum: { total_amount: true },
      }),
      prisma.payment.groupBy({
        by: ['unit_id'],
        where: { association_id: associationId, payment_date: { lte: to } },
        _sum: { amount: true },
      }),
      prisma.bill.groupBy({
        by: ['unit_id'],
        where: { association_id: associationId, due_date: { gt: today, lte: billCutoff } },
        _sum: { total_amount: true },
      }),
    ]);

    const billedBy   = new Map(billed.map(b => [b.unit_id, num(b._sum.total_amount)]));
    const paidBy     = new Map(paid.map(p => [p.unit_id, num(p._sum.amount)]));
    const upcomingBy = new Map(upcoming.map(b => [b.unit_id, num(b._sum.total_amount)]));

    const rows = units.map(u => {
      const owed = Math.round(((billedBy.get(u.id) ?? 0) - (paidBy.get(u.id) ?? 0)) * 100) / 100;
      const soon = Math.round((upcomingBy.get(u.id) ?? 0) * 100) / 100;
      return {
        ...u,
        billed: billedBy.get(u.id) ?? 0,
        paid:   paidBy.get(u.id) ?? 0,
        balance: owed,
        // Never negative: a flat in credit is not carrying an upcoming charge
        // it has already covered.
        not_yet_due: Math.max(0, Math.min(soon, owed)),
      };
    });

    return {
      data: rows,
      totals: {
        // A credit balance is a real thing — someone paid ahead — and must not
        // be netted against arrears, or the total owed looks smaller than it is.
        outstanding: Math.round(rows.filter(r => r.balance > 0)
                        .reduce((s, r) => s + r.balance, 0) * 100) / 100,
        in_credit:   Math.round(Math.abs(rows.filter(r => r.balance < 0)
                        .reduce((s, r) => s + r.balance, 0)) * 100) / 100,
        flats_owing: rows.filter(r => r.balance > 0).length,
        // Split out of `outstanding` so a treasurer can see true arrears.
        not_yet_due: Math.round(rows.reduce((s, r) => s + r.not_yet_due, 0) * 100) / 100,
        overdue:     Math.round(rows.filter(r => r.balance > 0)
                        .reduce((s, r) => s + (r.balance - r.not_yet_due), 0) * 100) / 100,
      },
      as_of: iso(to),
    };
  }
}

export const statementService = new StatementService();
