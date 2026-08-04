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
  /** Charges only. When the amount becomes payable. */
  due_date?: string;
  /** Raised but not yet payable. Part of the balance, but not arrears. */
  not_yet_due?: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const num = (d: unknown) => Number(d ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

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

    // A ledger is dated by when a charge was POSTED, never by when it falls
    // due. Dating lines by due_date put future-dated rows in a running balance
    // — an August bill due on the 10th appeared as a 10-Aug line on the 4th —
    // which is not something a statement may do.
    //
    // The posting date is the first day of the bill's period. Not created_at:
    // the Park Avenue import wrote every historical bill with created_at set
    // to the import date, which would file June's bill in July and bunch years
    // of history onto one day. period_month/period_year survive the import
    // intact, so they are the honest source.
    //
    // The due date still matters — it is what makes a balance overdue — so it
    // travels on the line rather than driving it.
    const today = new Date(); today.setHours(23, 59, 59, 999);
    // Built in UTC, matching `from` and how Prisma hands back a @db.Date.
    // A local-midnight Date renders as the previous day through toISOString()
    // once east of Greenwich — 1 Aug in IST would print as 31 Jul.
    const postedAt = (b: { period_year: number; period_month: number }) =>
      new Date(Date.UTC(b.period_year, b.period_month - 1, 1));

    // Bills are filtered in JS: the posting date is computed from two columns,
    // so it cannot be expressed as a Prisma date filter. One flat has tens of
    // bills, so fetching them all is cheaper than the raw query would be.
    const [allBills, allPenalties, paymentsBefore, payments] = await Promise.all([
      prisma.bill.findMany({
        where:  { unit_id: unitId, association_id: associationId },
        select: {
          id: true, due_date: true, period_month: true, period_year: true,
          base_amount: true, penalty: true, levy_amount: true, total_amount: true,
          bill_label: true, status: true,
        },
      }),
      // Penalties are charged long after the bill they sit on, so they are
      // their own dated lines. Folding them into the bill's line would make an
      // August charge silently grow in October, which is the sort of thing a
      // resident notices and never trusts again.
      prisma.billPenalty.findMany({
        where:  { association_id: associationId, bill: { unit_id: unitId } },
        select: {
          id: true, amount: true, charged_on: true, days_overdue: true,
          waived_at: true, waive_reason: true,
          bill: { select: { id: true, period_month: true, period_year: true, bill_label: true } },
        },
      }),
      prisma.payment.aggregate({
        where:  { unit_id: unitId, association_id: associationId, payment_date: { lt: from } },
        _sum:   { amount: true },
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

    // bills.total_amount includes any live penalty. Since penalties get their
    // own lines below, the bill's line must be net of them or the charge lands
    // on the statement twice. Subtracting the live rows — rather than using
    // base + levy — keeps imported bills right too: those carry a penalty
    // inside total_amount with no row to explain it, and it should stay where
    // the import put it.
    const livePenaltyByBill = new Map<string, number>();
    for (const p of allPenalties) {
      if (p.waived_at) continue;
      livePenaltyByBill.set(p.bill.id, (livePenaltyByBill.get(p.bill.id) ?? 0) + num(p.amount));
    }

    const dated = allBills
      .map(b => ({
        ...b,
        posted: postedAt(b),
        net_amount: round2(num(b.total_amount) - (livePenaltyByBill.get(b.id) ?? 0)),
      }))
      .sort((a, b) => a.posted.getTime() - b.posted.getTime());

    // Anything posted after `to` is not on this statement at all — including
    // next month's bills if someone generated them early.
    const billsBeforeSum = dated.filter(b => b.posted < from)
                                .reduce((s, b) => s + b.net_amount, 0);
    const bills = dated.filter(b => b.posted >= from && b.posted <= to);

    // Penalty charges land on the day they were charged; waivers on the day
    // they were forgiven. Both before `from` fold into the opening balance.
    const penaltyMoves: Array<{ at: Date; amount: number; text: string; ref: string | null }> = [];
    for (const p of allPenalties) {
      const label = p.bill.bill_label
        ?? `${MONTHS[p.bill.period_month - 1] ?? p.bill.period_month} ${p.bill.period_year}`;
      penaltyMoves.push({
        at: p.charged_on, amount: num(p.amount),
        text: `Late payment penalty — ${label} (${p.days_overdue} days overdue)`,
        ref: null,
      });
      if (p.waived_at) {
        penaltyMoves.push({
          at: p.waived_at, amount: -num(p.amount),
          text: `Penalty waived — ${label}`,
          ref: p.waive_reason,
        });
      }
    }
    const penaltyBefore = penaltyMoves.filter(m => m.at < from)
                                      .reduce((s, m) => s + m.amount, 0);

    const opening = billsBeforeSum + penaltyBefore - num(paymentsBefore._sum.amount);

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
        at: b.posted, order: 0,
        line: {
          date: iso(b.posted),
          kind: 'CHARGE',
          description: parts.length ? `${label} (incl. ${parts.join(', ')})` : label,
          reference: null,
          amount: b.net_amount,
          due_date: iso(b.due_date),
          not_yet_due: b.due_date > today,
        },
      });
    }

    // order 1: after the bill it belongs to, before the payment that clears it.
    for (const m of penaltyMoves) {
      if (m.at < from || m.at > to) continue;
      entries.push({
        at: m.at, order: 1,
        line: {
          date: iso(m.at),
          kind: 'CHARGE',
          description: m.text,
          reference: m.ref,
          amount: m.amount,
        },
      });
    }

    for (const p of payments) {
      entries.push({
        at: p.payment_date, order: 2,
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

    const charged = bills.reduce((s, b) => s + b.net_amount, 0)
                  + penaltyMoves.filter(m => m.at >= from && m.at <= to && m.amount > 0)
                                .reduce((s, m) => s + m.amount, 0);
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
        // Net of penalty: a penalty is charged only once a bill is already
        // late, so it can never be part of what is not yet due.
        not_yet_due: round2(bills.filter(b => b.due_date > today)
                        .reduce((s, b) => s + b.net_amount, 0)),
        // Split out because a treasurer chasing arrears wants to know how much
        // of the balance is penalty rather than principal.
        penalty_charged: round2(
          penaltyMoves.filter(m => m.at >= from && m.at <= to)
                      .reduce((s, m) => s + m.amount, 0)),
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

    // Same posting-date rule as forUnit: a bill counts from the first day of
    // its period, not from its due day. That cannot be expressed as a Prisma
    // filter across two integer columns, so this one is raw SQL — and being a
    // single grouped query it is also the cheapest form for a screen that is
    // opened constantly.
    const today = new Date(); today.setHours(23, 59, 59, 999);

    const [billed, paid] = await Promise.all([
      prisma.$queryRaw<Array<{ unit_id: string; billed: unknown; soon: unknown }>>`
        SELECT unit_id,
               SUM(total_amount)                                          AS billed,
               SUM(total_amount) FILTER (WHERE due_date > ${today})        AS soon
          FROM bills
         WHERE association_id = ${associationId}::uuid
           AND make_date(period_year, period_month, 1) <= ${to}
         GROUP BY unit_id
      `,
      prisma.payment.groupBy({
        by: ['unit_id'],
        where: { association_id: associationId, payment_date: { lte: to } },
        _sum: { amount: true },
      }),
    ]);

    const billedBy   = new Map(billed.map(b => [b.unit_id, num(b.billed)]));
    const upcomingBy = new Map(billed.map(b => [b.unit_id, num(b.soon)]));
    const paidBy     = new Map(paid.map(p => [p.unit_id, num(p._sum.amount)]));

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
