import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetInsightsQuery, type Insights } from '../../store/api/analyticsApi';

// ── Formatting ────────────────────────────────────────────────────────────────
const inr = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');
const inrShort = (n: number) => {
  if (Math.abs(n) >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (Math.abs(n) >= 100000)   return '₹' + (n / 100000).toFixed(1) + 'L';
  if (Math.abs(n) >= 1000)     return '₹' + Math.round(n / 1000) + 'k';
  return '₹' + Math.round(n);
};
const monthLabel = (p: string) => {
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

// ── Shared bits ───────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#1e293b',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
};
const th: React.CSSProperties = {
  padding: '7px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '8px 10px', fontSize: 12.5, color: '#1e293b', borderBottom: '1px solid #f1f5f9',
};

function Kpi({ label, value, sub, tone = 'default' }: {
  label: string; value: string; sub?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const color = { default: '#1e293b', good: '#16a34a', warn: '#d97706', bad: '#dc2626' }[tone];
  return (
    <div style={{ ...card, flex: '1 1 170px', minWidth: 160 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Grouped bar chart — plain SVG, no chart dependency. */
function BilledVsCollected({ series }: { series: Insights['collections']['series'] }) {
  if (series.length === 0) return <div style={{ color: '#94a3b8', fontSize: 13 }}>No data.</div>;
  const max = Math.max(...series.flatMap(s => [s.billed, s.collected]), 1);
  const W = 560, H = 170, pad = 26;
  const groupW = (W - pad) / series.length;
  const barW = Math.min(groupW / 2 - 5, 22);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 26}`} style={{ width: '100%', minWidth: 460, height: H + 26 }}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={pad} x2={W} y1={H - f * (H - 12)} y2={H - f * (H - 12)} stroke="#f1f5f9" />
            <text x={0} y={H - f * (H - 12) + 3} fontSize={8.5} fill="#cbd5e1">{inrShort(max * f)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = pad + i * groupW;
          const bh = (v: number) => Math.max((v / max) * (H - 12), v > 0 ? 2 : 0);
          return (
            <g key={s.period}>
              <rect x={x + 2} y={H - bh(s.billed)} width={barW} height={bh(s.billed)} rx={2} fill="#cbd5e1" />
              <rect x={x + barW + 5} y={H - bh(s.collected)} width={barW} height={bh(s.collected)} rx={2} fill="#2563eb" />
              <text x={x + barW} y={H + 13} fontSize={9} fill="#64748b" textAnchor="middle">{monthLabel(s.period)}</text>
              <text x={x + barW} y={H + 23} fontSize={8.5}
                fill={s.efficiency >= 90 ? '#16a34a' : s.efficiency >= 70 ? '#d97706' : '#dc2626'}
                textAnchor="middle" fontWeight={700}>
                {s.billed > 0 ? `${s.efficiency}%` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b', marginTop: 4 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#cbd5e1', borderRadius: 2, marginRight: 5 }} />Billed</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563eb', borderRadius: 2, marginRight: 5 }} />Collected</span>
      </div>
    </div>
  );
}

/** Horizontal proportion bars — used for ageing, categories, vendors. */
function BarList({ rows, color = '#2563eb', emptyText }: {
  rows: { label: string; value: number; hint?: string }[];
  color?: string; emptyText: string;
}) {
  if (rows.length === 0) return <div style={{ color: '#94a3b8', fontSize: 13 }}>{emptyText}</div>;
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: '#334155' }}>{r.label}</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>
              {inr(r.value)}{r.hint ? <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {r.hint}</span> : null}
            </span>
          </div>
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
            <div style={{ height: 6, width: `${(r.value / max) * 100}%`, background: color, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [months, setMonths] = useState(6);
  const { data, isLoading, isFetching, error, refetch } = useGetInsightsQuery(months);
  const d = data?.data;

  // Surface the server's actual message — a silent spinner hides real failures.
  const errMsg = (() => {
    if (!error) return null;
    const e = error as { status?: number | string; data?: { message?: string; detail?: string } };
    if (e.status === 403) return 'You do not have permission to view insights.';
    return e.data?.message ?? e.data?.detail ?? `Request failed (${e.status ?? 'unknown error'}).`;
  })();

  const AGEING_COLORS: Record<string, string> = {
    'Not due': '#94a3b8', '1-30 days': '#22c55e', '31-60 days': '#f59e0b',
    '61-90 days': '#ef4444', '90+ days': '#b91c1c',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Reports' }, { label: 'Insights' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1180 }}>

        {/* Period selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Period</span>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 7, overflow: 'hidden' }}>
            {[3, 6, 12].map(m => (
              <button key={m} onClick={() => setMonths(m)} style={{
                padding: '6px 14px', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: months === m ? '#2563eb' : '#fff',
                color: months === m ? '#fff' : '#475569',
                borderLeft: m !== 3 ? '1px solid #e2e8f0' : 'none',
              }}>{m} months</button>
            ))}
          </div>
          {isFetching && <span style={{ fontSize: 12, color: '#94a3b8' }}>Updating…</span>}
        </div>

        {errMsg ? (
          <div style={{ ...card, borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Could not load insights</div>
            <div style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>{errMsg}</div>
            <button onClick={() => refetch()} style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
              background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Retry</button>
          </div>
        ) : isLoading || !d ? (
          <div style={{ ...card, textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
            Loading insights…
          </div>
        ) : (
          <>
            {/* ── 1. Collections ─────────────────────────────────────────── */}
            <div style={sectionTitle}>Collections &amp; Cash</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <Kpi label="Collection rate" value={`${d.collections.efficiency}%`}
                sub={`${inr(d.collections.totalCollected)} of ${inr(d.collections.totalBilled)}`}
                tone={d.collections.efficiency >= 90 ? 'good' : d.collections.efficiency >= 70 ? 'warn' : 'bad'} />
              <Kpi label="Outstanding" value={inr(d.collections.outstanding)}
                sub="Unpaid + partial bills"
                tone={d.collections.outstanding > 0 ? 'warn' : 'good'} />
              <Kpi label="Chronic defaulters" value={String(d.collections.defaulters.length)}
                sub="Units with 3+ unpaid bills"
                tone={d.collections.defaulters.length > 0 ? 'bad' : 'good'} />
              <Kpi label="Cash payments" value={`${d.collections.cash_share_pct}%`}
                sub="Share received as cash"
                tone={d.collections.cash_share_pct > 40 ? 'warn' : 'default'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 24 }}>
              <div style={card}>
                <div style={{ ...sectionTitle, fontSize: 12 }}>Billed vs Collected</div>
                <BilledVsCollected series={d.collections.series} />
              </div>
              <div style={card}>
                <div style={{ ...sectionTitle, fontSize: 12 }}>Arrears by age</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.collections.ageing.length === 0
                    ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Nothing outstanding.</div>
                    : d.collections.ageing.map(b => {
                        const max = Math.max(...d.collections.ageing.map(x => x.amount), 1);
                        return (
                          <div key={b.bucket}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span style={{ color: '#334155' }}>{b.bucket}</span>
                              <span style={{ fontWeight: 600 }}>{inr(b.amount)}
                                <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {b.bills} bill{b.bills !== 1 ? 's' : ''}</span>
                              </span>
                            </div>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                              <div style={{ height: 6, width: `${(b.amount / max) * 100}%`, background: AGEING_COLORS[b.bucket] ?? '#2563eb', borderRadius: 3 }} />
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>

            {d.collections.defaulters.length > 0 && (
              <div style={{ ...card, marginBottom: 24, padding: 0 }}>
                <div style={{ ...sectionTitle, fontSize: 12, padding: '14px 18px 0' }}>Units needing follow-up</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, paddingLeft: 18 }}>Unit</th>
                    <th style={th}>Unpaid bills</th>
                    <th style={th}>Outstanding</th>
                    <th style={th}>Oldest due</th>
                  </tr></thead>
                  <tbody>
                    {d.collections.defaulters.map(u => (
                      <tr key={u.unit}>
                        <td style={{ ...td, paddingLeft: 18, fontWeight: 600 }}>{u.unit}</td>
                        <td style={td}>{u.unpaid_bills}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#dc2626' }}>{inr(u.outstanding)}</td>
                        <td style={{ ...td, color: '#64748b' }}>
                          {new Date(u.oldest_due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── 2. Expenses ────────────────────────────────────────────── */}
            <div style={sectionTitle}>Spending &amp; Vendors</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <Kpi label="Total spend" value={inr(d.expenses.totalSpend)} sub={`Over ${d.months} months`} />
              <Kpi label="Monthly average" value={inr(d.expenses.avgMonthly)} />
              <Kpi label="Largest vendor share" value={`${d.expenses.topVendorShare}%`}
                sub={d.expenses.vendors[0]?.vendor ?? '—'}
                tone={d.expenses.topVendorShare > 50 ? 'warn' : 'default'} />
              <Kpi label="Spend alerts" value={String(d.expenses.anomalies.length)}
                sub="Categories above trend"
                tone={d.expenses.anomalies.length > 0 ? 'warn' : 'good'} />
            </div>

            {d.expenses.anomalies.length > 0 && (
              <div style={{ ...card, marginBottom: 14, borderLeft: '4px solid #f59e0b' }}>
                <div style={{ ...sectionTitle, fontSize: 12, color: '#b45309' }}>Unusual spending this month</div>
                {d.expenses.anomalies.map(a => (
                  <div key={a.category} style={{ fontSize: 12.5, color: '#334155', marginBottom: 4 }}>
                    <b>{a.category}</b> — {inr(a.latest)} this month vs {inr(a.avg_prior)} average
                    <span style={{ color: '#b45309', fontWeight: 600 }}> (+{a.increase_pct}%)</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div style={card}>
                <div style={{ ...sectionTitle, fontSize: 12 }}>By category</div>
                <BarList
                  rows={d.expenses.categories.map(c => ({ label: c.category, value: c.total, hint: `${c.txns}` }))}
                  color="#f59e0b" emptyText="No expenses recorded."
                />
              </div>
              <div style={card}>
                <div style={{ ...sectionTitle, fontSize: 12 }}>By vendor</div>
                <BarList
                  rows={d.expenses.vendors.map(v => ({ label: v.vendor, value: v.total, hint: `${v.txns}` }))}
                  color="#0891b2" emptyText="No vendor spend recorded."
                />
              </div>
            </div>

            {/* ── 3. Maintenance ─────────────────────────────────────────── */}
            <div style={sectionTitle}>Maintenance Performance</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <Kpi label="Tickets raised" value={String(d.maintenance.total)} sub={`${d.maintenance.open} still open`} />
              <Kpi label="SLA breach rate" value={`${d.maintenance.breach_rate}%`}
                sub={`${d.maintenance.breached} breached`}
                tone={d.maintenance.breach_rate > 20 ? 'bad' : d.maintenance.breach_rate > 10 ? 'warn' : 'good'} />
              <Kpi label="Resident rating" value={d.maintenance.avg_rating != null ? `${d.maintenance.avg_rating} / 5` : '—'}
                sub="Average feedback"
                tone={d.maintenance.avg_rating != null && d.maintenance.avg_rating < 3 ? 'warn' : 'good'} />
              <Kpi label="Recurring issues" value={String(d.maintenance.repeat_issues.length)}
                sub="Same unit, same problem 3+ times"
                tone={d.maintenance.repeat_issues.length > 0 ? 'warn' : 'good'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div style={{ ...card, padding: 0 }}>
                <div style={{ ...sectionTitle, fontSize: 12, padding: '14px 18px 0' }}>Resolution time by category</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, paddingLeft: 18 }}>Category</th>
                    <th style={th}>Tickets</th>
                    <th style={th}>Avg. hours</th>
                    <th style={th}>Breached</th>
                  </tr></thead>
                  <tbody>
                    {d.maintenance.by_category.length === 0 && (
                      <tr><td colSpan={4} style={{ ...td, color: '#94a3b8', textAlign: 'center' }}>No tickets in this period.</td></tr>
                    )}
                    {d.maintenance.by_category.map(c => (
                      <tr key={c.category}>
                        <td style={{ ...td, paddingLeft: 18 }}>{c.category.replace(/_/g, ' ')}</td>
                        <td style={td}>{c.tickets}</td>
                        <td style={td}>{c.avg_hours != null ? `${c.avg_hours}h` : '—'}</td>
                        <td style={{ ...td, color: c.breached > 0 ? '#dc2626' : '#94a3b8', fontWeight: c.breached > 0 ? 600 : 400 }}>
                          {c.breached}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ ...card, padding: 0 }}>
                <div style={{ ...sectionTitle, fontSize: 12, padding: '14px 18px 0' }}>Recurring problems</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, paddingLeft: 18 }}>Unit</th>
                    <th style={th}>Issue</th>
                    <th style={th}>Times</th>
                  </tr></thead>
                  <tbody>
                    {d.maintenance.repeat_issues.length === 0 && (
                      <tr><td colSpan={3} style={{ ...td, color: '#94a3b8', textAlign: 'center' }}>
                        No recurring issues — good sign.
                      </td></tr>
                    )}
                    {d.maintenance.repeat_issues.map(r => (
                      <tr key={r.unit + r.category}>
                        <td style={{ ...td, paddingLeft: 18, fontWeight: 600 }}>{r.unit}</td>
                        <td style={td}>{r.category.replace(/_/g, ' ')}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#d97706' }}>{r.tickets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 4. Governance ──────────────────────────────────────────── */}
            <div style={sectionTitle}>Governance &amp; Risk <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>· last 30 days</span></div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <Kpi label="Failed sign-ins" value={String(d.governance.failed_logins)}
                sub={`${d.governance.distinct_actors} different numbers`}
                tone={d.governance.failed_logins > 10 ? 'warn' : 'default'} />
              <Kpi label="After-hours changes" value={String(d.governance.after_hours_changes)}
                sub="Financial edits 9pm–7am"
                tone={d.governance.after_hours_changes > 0 ? 'warn' : 'good'} />
              <Kpi label="Destructive actions" value={String(d.governance.destructive_actions)}
                sub="Deletes, rollbacks, FY reopens"
                tone={d.governance.destructive_actions > 0 ? 'warn' : 'good'} />
              <Kpi label="Audit events" value={String(d.governance.by_action.reduce((s, a) => s + a.events, 0))}
                sub="Total recorded" />
            </div>

            <div style={{ ...card, padding: 0 }}>
              <div style={{ ...sectionTitle, fontSize: 12, padding: '14px 18px 0' }}>Recent financial changes</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={{ ...th, paddingLeft: 18 }}>When</th>
                  <th style={th}>Action</th>
                  <th style={th}>What</th>
                  <th style={th}>Who</th>
                </tr></thead>
                <tbody>
                  {d.governance.recent_financial_changes.length === 0 && (
                    <tr><td colSpan={4} style={{ ...td, color: '#94a3b8', textAlign: 'center' }}>
                      No financial changes recorded in the last 30 days.
                    </td></tr>
                  )}
                  {d.governance.recent_financial_changes.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...td, paddingLeft: 18, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={td}>{c.action.replace(/_/g, ' ')}</td>
                      <td style={td}>{c.summary ?? c.entity_type}</td>
                      <td style={td}>{c.performer?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
