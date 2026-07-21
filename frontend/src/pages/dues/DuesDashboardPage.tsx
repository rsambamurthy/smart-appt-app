import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import { useGetDuesDashboardQuery, useListBillsQuery } from '../../store/api/duesApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISODate(d: Date) { return d.toISOString().split('T')[0]; }
function todayStr() { return toISODate(new Date()); }
function firstOfMonthStr() {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function daysBetween(from: string, to: string) {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtAmount(val: unknown) { return '₹' + Number(val).toLocaleString('en-IN'); }
function flatLabel(bill: Record<string, unknown>) {
  const u = bill['unit'] as Record<string, string> | undefined;
  if (!u) return '—';
  return u['block'] ? `${u['block']}-${u['flat_number']}` : u['flat_number'];
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  fontSize: '0.875rem',
  background: 'var(--color-bg-input)',
  color: 'var(--color-text)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DuesDashboardPage() {
  const [tab, setTab] = useState<'paid' | 'arrears'>('paid');
  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [applied, setApplied] = useState({ from: firstOfMonthStr(), to: todayStr() });

  const { data: dash } = useGetDuesDashboardQuery();
  const d = dash?.data as Record<string, unknown> | undefined;

  const paidQuery = useListBillsQuery(
    { status: 'PAID', from_date: applied.from, to_date: applied.to, limit: 500 },
    { skip: tab !== 'paid' },
  );
  const arrearsQuery = useListBillsQuery(
    { status: 'UNPAID,PARTIAL', from_date: applied.from, to_date: applied.to, limit: 500 },
    { skip: tab !== 'arrears' },
  );

  const paidBills = (paidQuery.data?.data ?? []) as Record<string, unknown>[];
  const arrearsBills = (arrearsQuery.data?.data ?? []) as Record<string, unknown>[];
  const today = todayStr();

  const tabBtn = (t: 'paid' | 'arrears', icon: string, label: string, count?: number) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '8px 24px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s',
        background: tab === t ? 'var(--color-primary)' : 'var(--color-bg-card)',
        color: tab === t ? '#fff' : 'var(--color-text)',
        boxShadow: tab === t ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      {icon} {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  );

  return (
    <Layout>
      <div className="page-header"><h1>Dues Overview</h1></div>

      {/* Stats row */}
      {d && (
        <div className={d['cash_balance'] != null ? 'grid-4' : 'grid-3'} style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="value">₹{Number(d['total_outstanding']).toLocaleString('en-IN')}</div>
            <div className="label">Outstanding</div>
          </div>
          <div className="stat-card">
            <div className="value">₹{Number(d['monthly_collected']).toLocaleString('en-IN')}</div>
            <div className="label">Collected This Month</div>
          </div>
          <div className="stat-card">
            <div className="value">{Number(d['arrears_count'] ?? 0)}</div>
            <div className="label">Units in Arrears</div>
          </div>
          {d['cash_balance'] != null && (
            <div className="stat-card">
              <div className="value">₹{Number(d['cash_balance']).toLocaleString('en-IN')}</div>
              <div className="label">Cash / Bank Balance</div>
              {d['cash_balance_as_on'] && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                  as on {new Date(d['cash_balance_as_on'] as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Date range filter */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Filter by Due Date</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
          From
          <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
          To
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
        </label>
        <button
          onClick={() => setApplied({ from: fromDate, to: toDate })}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--color-primary)', color: '#fff',
            fontWeight: 600, fontSize: '0.875rem',
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          Search
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {tabBtn('paid', '✓', 'Paid', tab === 'paid' ? paidBills.length : undefined)}
        {tabBtn('arrears', '⚠', 'Arrears', tab === 'arrears' ? arrearsBills.length : undefined)}
      </div>

      {/* Paid Tab */}
      {tab === 'paid' && (
        <div className="card">
          {paidQuery.isLoading ? (
            <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
          ) : paidBills.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No paid bills in this date range.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem' }}>Unit</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem' }}>Due Date</th>
                  <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>Due Amount</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem' }}>Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {paidBills.map((b) => {
                  const payments = (b['payments'] as Array<Record<string, unknown>>) ?? [];
                  const paidDate = payments.length ? payments[payments.length - 1]['payment_date'] as string : null;
                  return (
                    <tr key={b['id'] as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500 }}>{flatLabel(b)}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-text-secondary)' }}>{fmtDate(b['due_date'] as string)}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{fmtAmount(b['total_amount'])}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#22c55e', fontWeight: 500 }}>{fmtDate(paidDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Arrears Tab */}
      {tab === 'arrears' && (
        <div className="card">
          {arrearsQuery.isLoading ? (
            <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
          ) : arrearsBills.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No arrears in this date range.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem' }}>Unit</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem' }}>Due Date</th>
                  <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>Due Amount</th>
                  <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>Pending Days</th>
                </tr>
              </thead>
              <tbody>
                {arrearsBills.map((b) => {
                  const dueDate = (b['due_date'] as string)?.split('T')[0] ?? '';
                  const pending = dueDate && dueDate < today ? daysBetween(dueDate, today) : 0;
                  const isOverdue = pending > 0;
                  return (
                    <tr key={b['id'] as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500 }}>{flatLabel(b)}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--color-text-secondary)' }}>{fmtDate(dueDate)}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{fmtAmount(b['total_amount'])}</td>
                      <td style={{
                        padding: '0.6rem 0.5rem', textAlign: 'right',
                        color: isOverdue ? '#ef4444' : 'var(--color-text-secondary)',
                        fontWeight: isOverdue ? 600 : 400,
                      }}>
                        {isOverdue ? `${pending} days` : 'Not yet due'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Layout>
  );
}
