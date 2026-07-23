import { useState, useRef } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetPnLQuery, PnLRow } from '../../store/api/accountingApi';

// ── Financial year helpers ────────────────────────────────────────────────────
function fyRange(startYear: number) {
  return {
    from: `${startYear}-04-01`,
    to:   `${startYear + 1}-03-31`,
    label: `FY ${startYear}-${String(startYear + 1).slice(2)}`,
  };
}

function currentFYStart() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // April = month 3
}

const FY_OPTIONS = [currentFYStart(), currentFYStart() - 1, currentFYStart() - 2].map(fyRange);

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Section row ───────────────────────────────────────────────────────────────
function AccountRow({ row, isExpense }: { row: PnLRow; isExpense: boolean }) {
  const color  = isExpense ? '#dc2626' : '#16a34a';
  const amount = row.amount;
  return (
    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
      <td style={{ padding: '8px 20px', color: '#475569', fontSize: 12.5 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 8 }}>{row.code}</span>
        {row.name}
        {row.sub_type && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>({row.sub_type})</span>}
      </td>
      <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 13, fontWeight: amount > 0 ? 600 : 400, color: amount > 0 ? color : '#94a3b8' }}>
        {amount > 0 ? fmtAmt(amount) : '—'}
      </td>
    </tr>
  );
}

export default function PnLPage() {
  const [mode,   setMode]   = useState<'fy' | 'custom'>('fy');
  const [fyIdx,  setFyIdx]  = useState(0);
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');
  const [applied, setApplied] = useState<{ from: string; to: string; label: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleView = () => {
    if (mode === 'fy') {
      const fy = FY_OPTIONS[fyIdx];
      setApplied({ from: fy.from, to: fy.to, label: fy.label });
    } else {
      if (!from || !to) return;
      setApplied({ from, to, label: `${fmtDate(from)} — ${fmtDate(to)}` });
    }
  };

  const { data, isLoading, isFetching } = useGetPnLQuery(
    { from: applied?.from ?? '', to: applied?.to ?? '' },
    { skip: !applied }
  );

  const pnl = data?.data;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>P&L Statement</title><style>
        body { font-family: Arial, sans-serif; font-size: 12pt; color: #000; margin: 24pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6pt 10pt; }
        .section-header { background: #f3f4f6; font-weight: 700; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.05em; }
        .total-row { font-weight: 700; border-top: 2pt solid #000; }
        .net-row { font-weight: 700; font-size: 13pt; border-top: 2pt solid #000; border-bottom: 2pt solid #000; }
        .right { text-align: right; }
        .muted { color: #6b7280; }
        .title { text-align: center; margin-bottom: 18pt; }
        .title h2 { font-size: 16pt; margin: 0 0 4pt; }
        .title p  { font-size: 11pt; color: #6b7280; margin: 0; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const fc: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Profit & Loss' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 760 }}>

        {/* Filter bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 7, overflow: 'hidden', width: 'fit-content' }}>
            {(['fy', 'custom'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '5px 16px', border: 'none', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                background: mode === m ? '#2563eb' : '#fff',
                color:      mode === m ? '#fff'    : '#64748b',
              }}>
                {m === 'fy' ? 'Financial Year' : 'Custom Range'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {mode === 'fy' ? (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Financial Year</label>
                <select style={{ ...fc, width: 180 }} value={fyIdx} onChange={e => setFyIdx(Number(e.target.value))}>
                  {FY_OPTIONS.map((fy, i) => <option key={i} value={i}>{fy.label}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>From</label>
                  <input type="date" style={fc} value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>To</label>
                  <input type="date" style={fc} value={to} onChange={e => setTo(e.target.value)} />
                </div>
              </>
            )}
            <button onClick={handleView} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Generate
            </button>
          </div>
        </div>

        {/* Statement */}
        {isLoading || isFetching ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Generating…</div>
        ) : !pnl ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Select a period above and click Generate.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            {/* Print button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            {/* Printable body */}
            <div ref={printRef} style={{ padding: '0 0 8px' }}>
              {/* Title */}
              <div className="title" style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Statement of Income & Expenditure
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {fmtDate(pnl.period.from)} — {fmtDate(pnl.period.to)}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                {/* ── INCOME ── */}
                <tbody>
                  <tr className="section-header" style={{ background: '#f0fdf4' }}>
                    <td style={{ padding: '8px 20px', fontSize: 10.5, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Income</td>
                    <td style={{ width: 160, padding: '8px 24px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</td>
                  </tr>
                  {pnl.income.length === 0 ? (
                    <tr><td colSpan={2} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No income recorded in this period.</td></tr>
                  ) : (
                    pnl.income.map(r => <AccountRow key={r.id} row={r} isExpense={false} />)
                  )}
                  <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '10px 20px', fontWeight: 700, fontSize: 13, color: '#16a34a' }}>Total Income</td>
                    <td style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#16a34a' }}>
                      {fmtAmt(pnl.totalIncome)}
                    </td>
                  </tr>

                  {/* Spacer */}
                  <tr><td colSpan={2} style={{ height: 12 }}></td></tr>

                  {/* ── EXPENSE ── */}
                  <tr className="section-header" style={{ background: '#fff7ed' }}>
                    <td style={{ padding: '8px 20px', fontSize: 10.5, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expenditure</td>
                    <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</td>
                  </tr>
                  {pnl.expense.length === 0 ? (
                    <tr><td colSpan={2} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No expenses recorded in this period.</td></tr>
                  ) : (
                    pnl.expense.map(r => <AccountRow key={r.id} row={r} isExpense={true} />)
                  )}
                  <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '10px 20px', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>Total Expenditure</td>
                    <td style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>
                      {fmtAmt(pnl.totalExpense)}
                    </td>
                  </tr>

                  {/* ── NET ── */}
                  <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                      {pnl.netSurplus >= 0 ? 'Net Surplus' : 'Net Deficit'}
                    </td>
                    <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block', padding: '5px 16px', borderRadius: 8,
                        background: pnl.netSurplus >= 0 ? '#dcfce7' : '#fee2e2',
                        color:      pnl.netSurplus >= 0 ? '#15803d' : '#dc2626',
                        fontWeight: 700, fontSize: 15,
                      }}>
                        {fmtAmt(pnl.netSurplus)}
                        <span style={{ fontSize: 11, marginLeft: 5, fontWeight: 600 }}>
                          {pnl.netSurplus >= 0 ? 'Surplus' : 'Deficit'}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Footer note */}
              <div style={{ padding: '10px 20px 4px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
                Generated from auto-posted and manual journal entries. All amounts in INR.
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
