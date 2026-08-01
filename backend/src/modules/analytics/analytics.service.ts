import prisma from '../../config/database';

/**
 * Association insights for Treasurer / Manager.
 *
 * Deliberately raw SQL: these are aggregation questions ("per month", "bucket
 * by age", "share of total") that Prisma's query builder expresses poorly and
 * that would otherwise pull thousands of rows into Node to reduce by hand.
 *
 * Every query is scoped by association_id — this data is tenant-sensitive.
 */

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const pct = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

// ── Row shapes returned by the raw queries ────────────────────────────────────
type MonthRow    = { period: string; billed: string | null; collected: string | null };
type AgeingRow   = { bucket: string; amount: string | null; bills: bigint };
type DefaulterRow= { unit_id: string; flat_number: string; block: string | null; unpaid_bills: bigint; outstanding: string | null; oldest_due: Date };
type ModeRow     = { payment_mode: string; total: string | null; txns: bigint };
type CatRow      = { category: string; total: string | null; txns: bigint };
type VendorRow   = { vendor: string; total: string | null; txns: bigint };
type SpendMonth  = { period: string; total: string | null };
type MttrRow     = { category: string; tickets: bigint; avg_hours: number | null; breached: bigint };
type RepeatRow   = { flat_number: string; block: string | null; category: string; tickets: bigint };
type ActionRow   = { action: string; events: bigint };

export class AnalyticsService {
  /**
   * @param months how many months of history to trend (default 6)
   */
  async getInsights(associationId: string, months = 6) {
    const monthsBack = Math.min(Math.max(months, 3), 24);

    const [collections, expenses, maintenance, governance] = await Promise.all([
      this.collections(associationId, monthsBack),
      this.expenses(associationId, monthsBack),
      this.maintenance(associationId, monthsBack),
      this.governance(associationId),
    ]);

    return { data: { months: monthsBack, collections, expenses, maintenance, governance } };
  }

  // ── 1. Collections & cash flow ──────────────────────────────────────────────
  private async collections(associationId: string, months: number) {
    // Billed vs collected per month. Billed is keyed on the bill's period,
    // collected on the payment date — they are different things on purpose:
    // efficiency compares money raised in a month against money received.
    const trend = await prisma.$queryRaw<MonthRow[]>`
      WITH period AS (
        SELECT to_char(d, 'YYYY-MM') AS period
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1}),
          date_trunc('month', CURRENT_DATE),
          '1 month'
        ) d
      ),
      billed AS (
        SELECT to_char(make_date(period_year, period_month, 1), 'YYYY-MM') AS period,
               SUM(total_amount) AS amt
        FROM bills
        WHERE association_id = ${associationId}::uuid
        GROUP BY 1
      ),
      paid AS (
        SELECT to_char(payment_date, 'YYYY-MM') AS period,
               SUM(amount) AS amt
        FROM payments
        WHERE association_id = ${associationId}::uuid
        GROUP BY 1
      )
      SELECT p.period,
             COALESCE(b.amt, 0)::text AS billed,
             COALESCE(x.amt, 0)::text AS collected
      FROM period p
      LEFT JOIN billed b ON b.period = p.period
      LEFT JOIN paid   x ON x.period = p.period
      ORDER BY p.period
    `;

    // Outstanding grouped by how overdue it is.
    const ageing = await prisma.$queryRaw<AgeingRow[]>`
      SELECT CASE
               WHEN b.due_date >= CURRENT_DATE                        THEN 'Not due'
               WHEN CURRENT_DATE - b.due_date BETWEEN 1  AND 30       THEN '1-30 days'
               WHEN CURRENT_DATE - b.due_date BETWEEN 31 AND 60       THEN '31-60 days'
               WHEN CURRENT_DATE - b.due_date BETWEEN 61 AND 90       THEN '61-90 days'
               ELSE '90+ days'
             END AS bucket,
             SUM(b.total_amount - COALESCE(p.paid, 0))::text AS amount,
             COUNT(*)::bigint AS bills
      FROM bills b
      LEFT JOIN (
        SELECT bill_id, SUM(amount) AS paid FROM payments GROUP BY bill_id
      ) p ON p.bill_id = b.id
      WHERE b.association_id = ${associationId}::uuid
        AND b.status IN ('UNPAID', 'PARTIAL')
      GROUP BY 1
    `;

    // Units carrying 3+ unpaid bills — the ones worth chasing personally.
    const defaulters = await prisma.$queryRaw<DefaulterRow[]>`
      SELECT u.id AS unit_id, u.flat_number, u.block,
             COUNT(b.id)::bigint AS unpaid_bills,
             SUM(b.total_amount - COALESCE(p.paid, 0))::text AS outstanding,
             MIN(b.due_date) AS oldest_due
      FROM bills b
      JOIN units u ON u.id = b.unit_id
      LEFT JOIN (
        SELECT bill_id, SUM(amount) AS paid FROM payments GROUP BY bill_id
      ) p ON p.bill_id = b.id
      WHERE b.association_id = ${associationId}::uuid
        AND b.status IN ('UNPAID', 'PARTIAL')
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.flat_number, u.block
      HAVING COUNT(b.id) >= 3
      ORDER BY SUM(b.total_amount - COALESCE(p.paid, 0)) DESC
      LIMIT 15
    `;

    // How residents actually pay — a high cash share is an internal-control risk.
    const modes = await prisma.$queryRaw<ModeRow[]>`
      SELECT payment_mode::text AS payment_mode,
             SUM(amount)::text  AS total,
             COUNT(*)::bigint   AS txns
      FROM payments
      WHERE association_id = ${associationId}::uuid
        AND payment_date >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})
      GROUP BY 1
      ORDER BY 2 DESC
    `;

    const series = trend.map(r => {
      const billed = n(r.billed), collected = n(r.collected);
      return { period: r.period, billed, collected, efficiency: pct(collected, billed) };
    });

    const totalBilled    = series.reduce((s, r) => s + r.billed, 0);
    const totalCollected = series.reduce((s, r) => s + r.collected, 0);
    const outstanding    = ageing.reduce((s, r) => s + n(r.amount), 0);
    const cashModeShare  = (() => {
      const total = modes.reduce((s, m) => s + n(m.total), 0);
      const cash  = modes.filter(m => m.payment_mode === 'CASH').reduce((s, m) => s + n(m.total), 0);
      return pct(cash, total);
    })();

    return {
      series,
      totalBilled,
      totalCollected,
      efficiency: pct(totalCollected, totalBilled),
      outstanding,
      ageing: ageing.map(r => ({ bucket: r.bucket, amount: n(r.amount), bills: Number(r.bills) })),
      defaulters: defaulters.map(r => ({
        unit: `${r.block ? r.block + '-' : ''}${r.flat_number}`,
        unpaid_bills: Number(r.unpaid_bills),
        outstanding: n(r.outstanding),
        oldest_due: r.oldest_due,
      })),
      payment_modes: modes.map(m => ({ mode: m.payment_mode, total: n(m.total), txns: Number(m.txns) })),
      cash_share_pct: cashModeShare,
    };
  }

  // ── 2. Expense & vendor analysis ────────────────────────────────────────────
  private async expenses(associationId: string, months: number) {
    const trend = await prisma.$queryRaw<SpendMonth[]>`
      WITH period AS (
        SELECT to_char(d, 'YYYY-MM') AS period
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1}),
          date_trunc('month', CURRENT_DATE),
          '1 month'
        ) d
      ),
      spend AS (
        SELECT to_char(expense_date, 'YYYY-MM') AS period, SUM(amount) AS amt
        FROM expenses
        WHERE association_id = ${associationId}::uuid
          AND deleted_at IS NULL
          AND status <> 'REJECTED'
        GROUP BY 1
      )
      SELECT p.period, COALESCE(s.amt, 0)::text AS total
      FROM period p LEFT JOIN spend s ON s.period = p.period
      ORDER BY p.period
    `;

    const categories = await prisma.$queryRaw<CatRow[]>`
      SELECT category,
             SUM(amount)::text AS total,
             COUNT(*)::bigint  AS txns
      FROM expenses
      WHERE association_id = ${associationId}::uuid
        AND deleted_at IS NULL
        AND status <> 'REJECTED'
        AND expense_date >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 12
    `;

    // Vendor concentration: how much of total spend one supplier receives.
    const vendors = await prisma.$queryRaw<VendorRow[]>`
      SELECT COALESCE(bp.name, e.vendor_name, 'Unspecified') AS vendor,
             SUM(e.amount)::text AS total,
             COUNT(*)::bigint    AS txns
      FROM expenses e
      LEFT JOIN business_partners bp ON bp.id = e.vendor_id
      WHERE e.association_id = ${associationId}::uuid
        AND e.deleted_at IS NULL
        AND e.status <> 'REJECTED'
        AND e.expense_date >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `;

    // Categories where the latest month is well above their own recent average.
    const anomalies = await prisma.$queryRaw<{ category: string; latest: string | null; avg_prior: string | null }[]>`
      WITH monthly AS (
        SELECT category,
               to_char(expense_date, 'YYYY-MM') AS period,
               SUM(amount) AS amt
        FROM expenses
        WHERE association_id = ${associationId}::uuid
          AND deleted_at IS NULL
          AND status <> 'REJECTED'
          AND expense_date >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months})
        GROUP BY 1, 2
      ),
      latest AS (
        SELECT category, amt FROM monthly
        WHERE period = to_char(CURRENT_DATE, 'YYYY-MM')
      ),
      prior AS (
        SELECT category, AVG(amt) AS avg_amt FROM monthly
        WHERE period <> to_char(CURRENT_DATE, 'YYYY-MM')
        GROUP BY 1
      )
      SELECT l.category, l.amt::text AS latest, p.avg_amt::text AS avg_prior
      FROM latest l
      JOIN prior  p ON p.category = l.category
      WHERE p.avg_amt > 0 AND l.amt > p.avg_amt * 1.5
      ORDER BY (l.amt - p.avg_amt) DESC
      LIMIT 5
    `;

    const series      = trend.map(r => ({ period: r.period, total: n(r.total) }));
    const totalSpend  = series.reduce((s, r) => s + r.total, 0);
    const vendorList  = vendors.map(v => ({ vendor: v.vendor, total: n(v.total), txns: Number(v.txns) }));
    const topVendorShare = vendorList.length ? pct(vendorList[0]!.total, totalSpend) : 0;

    return {
      series,
      totalSpend,
      avgMonthly: series.length ? Math.round(totalSpend / series.length) : 0,
      categories: categories.map(c => ({ category: c.category, total: n(c.total), txns: Number(c.txns) })),
      vendors: vendorList,
      topVendorShare,
      anomalies: anomalies.map(a => ({
        category: a.category,
        latest: n(a.latest),
        avg_prior: n(a.avg_prior),
        increase_pct: pct(n(a.latest) - n(a.avg_prior), n(a.avg_prior)),
      })),
    };
  }

  // ── 3. Maintenance operations ───────────────────────────────────────────────
  private async maintenance(associationId: string, months: number) {
    const byCategory = await prisma.$queryRaw<MttrRow[]>`
      SELECT category::text AS category,
             COUNT(*)::bigint AS tickets,
             AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
               FILTER (WHERE resolved_at IS NOT NULL) AS avg_hours,
             COUNT(*) FILTER (WHERE sla_breached)::bigint AS breached
      FROM maintenance_tickets
      WHERE association_id = ${associationId}::uuid
        AND created_at >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})
      GROUP BY 1
      ORDER BY 2 DESC
    `;

    // Same flat, same problem, repeatedly — usually a capital issue, not a fix.
    const repeats = await prisma.$queryRaw<RepeatRow[]>`
      SELECT u.flat_number, u.block, t.category::text AS category,
             COUNT(*)::bigint AS tickets
      FROM maintenance_tickets t
      JOIN units u ON u.id = t.unit_id
      WHERE t.association_id = ${associationId}::uuid
        AND t.created_at >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})
      GROUP BY u.flat_number, u.block, t.category
      HAVING COUNT(*) >= 3
      ORDER BY 4 DESC
      LIMIT 10
    `;

    const totals = await prisma.$queryRaw<{ total: bigint; open: bigint; breached: bigint; avg_rating: number | null }[]>`
      SELECT COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','CLOSED'))::bigint AS open,
             COUNT(*) FILTER (WHERE sla_breached)::bigint AS breached,
             AVG(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating
      FROM maintenance_tickets
      WHERE association_id = ${associationId}::uuid
        AND created_at >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})
    `;

    const t = totals[0];
    const total = t ? Number(t.total) : 0;

    return {
      total,
      open:     t ? Number(t.open) : 0,
      breached: t ? Number(t.breached) : 0,
      breach_rate: t ? pct(Number(t.breached), total) : 0,
      avg_rating: t?.avg_rating != null ? Math.round(Number(t.avg_rating) * 10) / 10 : null,
      by_category: byCategory.map(r => ({
        category: r.category,
        tickets: Number(r.tickets),
        avg_hours: r.avg_hours != null ? Math.round(Number(r.avg_hours) * 10) / 10 : null,
        breached: Number(r.breached),
      })),
      repeat_issues: repeats.map(r => ({
        unit: `${r.block ? r.block + '-' : ''}${r.flat_number}`,
        category: r.category,
        tickets: Number(r.tickets),
      })),
    };
  }

  // ── 4. Governance & risk (built on the audit trail) ─────────────────────────
  private async governance(associationId: string) {
    const byAction = await prisma.$queryRaw<ActionRow[]>`
      SELECT action::text AS action, COUNT(*)::bigint AS events
      FROM audit_logs
      WHERE association_id = ${associationId}::uuid
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 2 DESC
    `;

    const signals = await prisma.$queryRaw<{
      failed_logins: bigint; distinct_actors: bigint;
      after_hours: bigint; deletions: bigint;
    }[]>`
      SELECT
        COUNT(*) FILTER (WHERE action = 'LOGIN_FAILED')::bigint AS failed_logins,
        COUNT(DISTINCT actor_label) FILTER (WHERE action = 'LOGIN_FAILED')::bigint AS distinct_actors,
        COUNT(*) FILTER (
          WHERE entity_type IN ('journal_entry','payment','bill_run','account','financial_year')
            AND (EXTRACT(HOUR FROM created_at) < 7 OR EXTRACT(HOUR FROM created_at) >= 21)
        )::bigint AS after_hours,
        COUNT(*) FILTER (WHERE action IN ('DELETE','ROLLBACK','REOPEN'))::bigint AS deletions
      FROM audit_logs
      WHERE association_id = ${associationId}::uuid
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const recentFinancial = await prisma.auditLog.findMany({
      where: {
        association_id: associationId,
        entity_type: { in: ['journal_entry', 'payment', 'bill_run', 'account', 'financial_year'] },
        created_at: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true, action: true, entity_type: true, summary: true, created_at: true,
        performer: { select: { name: true, role: true } },
      },
    });

    const s = signals[0];
    return {
      by_action: byAction.map(r => ({ action: r.action, events: Number(r.events) })),
      failed_logins:   s ? Number(s.failed_logins) : 0,
      distinct_actors: s ? Number(s.distinct_actors) : 0,
      after_hours_changes: s ? Number(s.after_hours) : 0,
      destructive_actions: s ? Number(s.deletions) : 0,
      recent_financial_changes: recentFinancial,
    };
  }
}

export const analyticsService = new AnalyticsService();
