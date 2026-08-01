import { useState, useRef, Fragment, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetIncomeExpenditureQuery, IEGroup, IEPeriod } from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function fyStart() {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Look up the same account one year earlier, for the comparative column.
function prevAmount(prev: IEPeriod | null, code: string, side: 'income' | 'expenditure') {
  if (!prev) return null;
  const row = (side === 'income' ? prev.income : prev.expenditure).find(r => r.code === code);
  return row ? row.amount : 0;
}

function Section({ title, color, bg, groups, total, totalLabel, prev, side, showPrev }: {
  title: string; color: string; bg: string;
  groups: IEGroup[]; total: number; totalLabel: string;
  prev: IEPeriod | null; side: 'income' | 'expenditure'; showPrev: boolean;
}) {
  const cols = showPrev ? 3 : 2;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        <tr style={{ background: bg }}>
          <td style={{ padding: '8px 20px', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {title}
          </td>
          <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current
          </td>
          {showPrev && (
            <td style={{ padding: '8px 20px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Previous
            </td>
          )}
        </tr>

        {groups.length === 0 ? (
          <tr><td colSpan={cols} style={{ padding: '1.5rem 20px', color: '#94a3b8', fontSize: 13 }}>Nothing in this period.</td></tr>
        ) : groups.map(g => (
          <Fragment key={g.label}>
            <tr>
              <td colSpan={cols} style={{ padding: '9px 20px 4px', fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                {g.label}
              </td>
            </tr>
            {g.rows.map(r => {
              const p = prevAmount(prev, r.code, side);
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '7px 12px 7px 34px', fontSize: 12.5, color: '#475569' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#cbd5e1', marginRight: 8 }}>{r.code}</span>
                    {r.name}
                  </td>
                  <td style={{ padding: '7px 16px', textAlign: 'right', fontSize: 12.5, fontWeight: 500, color: '#1e293b' }}>
                    {fmtAmt(r.amount)}
                  </td>
                  {showPrev && (
                    <td style={{ padding: '7px 20px', textAlign: 'right', fontSize: 12.5, color: '#94a3b8' }}>
                      {p === null ? '—' : fmtAmt(p)}
                    </td>
                  )}
                </tr>
              );
            })}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '5px 12px 5px 34px', fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>Sub-total</td>
              <td style={{ padding: '5px 16px', textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{fmtAmt(g.total)}</td>
              {showPrev && <td />}
            </tr>
          </Fragment>
        ))}

        <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
          <td style={{ padding: '11px 20px', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{totalLabel}</td>
          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13, color }}>{fmtAmt(total)}</td>
          {showPrev && (
            <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>
              {prev ? fmtAmt(side === 'income' ? prev.totalIncome : prev.totalExpenditure) : '—'}
            </td>
          )}
        </tr>
      </tbody>
    </table>
  );
}

export default function IncomeExpenditurePage() {
  const [from,    setFrom]    = useState(fyStart());
  const [to,      setTo]      = useState(todayStr());
  const [compare, setCompare] = useState(true);
  const [applied, setApplied] = useState<{ from: string; to: string; compare: boolean } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useGetIncomeExpenditureQuery(
    applied ?? { from: '', to: '' },
    { skip: !applied },
  );

  const ie       = data?.data;
  const showPrev = !!(ie?.previous);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Income and Expenditure Account</title><style>
        body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; margin: 20pt; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4pt 7pt; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const fc: CSSProperties = {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none',
  };
  const lbl: CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.04em', display: 'block', marginBottom: 4,
  };

  const isSurplus = (ie?.surplus ?? 0) >= 0;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Income & Expenditure' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1100 }}>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>From</label>
              <input type="date" style={fc} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>To</label>
              <input type="date" style={fc} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', paddingBottom: 8 }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              Compare with previous year
            </label>
            <button
              onClick={() => setApplied({ from, to, compare })}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Generate
            </button>
          </div>
        </div>

        {isLoading || isFetching ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Generating…</div>
        ) : !ie ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Choose a period and click Generate. Defaults to the current financial year.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: isSurplus ? '#15803d' : '#dc2626' }}>
                {isSurplus ? 'Surplus' : 'Deficit'} of {fmtAmt(ie.surplus)} for the period
              </div>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            <div ref={printRef}>
              <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Income and Expenditure Account
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  For the period {fmtDate(ie.period.from)} to {fmtDate(ie.period.to)}
                </div>
                {showPrev && ie.previous && (
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
                    Compared with {fmtDate(ie.previous.period.from)} to {fmtDate(ie.previous.period.to)}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ flex: '1 1 440px', borderRight: '1px solid #f1f5f9' }}>
                  <Section
                    title="Expenditure" color="#dc2626" bg="#fef2f2"
                    groups={ie.expenditureGroups} total={ie.totalExpenditure} totalLabel="Total Expenditure"
                    prev={ie.previous} side="expenditure" showPrev={showPrev}
                  />
                </div>
                <div style={{ flex: '1 1 440px' }}>
                  <Section
                    title="Income" color="#15803d" bg="#f0fdf4"
                    groups={ie.incomeGroups} total={ie.totalIncome} totalLabel="Total Income"
                    prev={ie.previous} side="income" showPrev={showPrev}
                  />
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderTop: '2px solid #e2e8f0',
                background: isSurplus ? '#f0fdf4' : '#fef2f2',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {isSurplus ? 'Excess of Income over Expenditure (Surplus)' : 'Excess of Expenditure over Income (Deficit)'}
                </span>
                <span style={{ display: 'flex', gap: 28, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: isSurplus ? '#15803d' : '#dc2626' }}>
                    {fmtAmt(ie.surplus)}
                  </span>
                  {showPrev && ie.previous && (
                    <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
                      prev {fmtAmt(ie.previous.surplus)}
                    </span>
                  )}
                </span>
              </div>

              <div style={{ padding: '10px 20px 16px', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
                Prepared on the accrual basis: dues are recognised when billed, not when collected.
                This will not agree with the Receipts &amp; Payments Account, which is cash-basis.
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
