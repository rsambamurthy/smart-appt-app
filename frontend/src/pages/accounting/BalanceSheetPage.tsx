import { useState, useRef, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetBalanceSheetQuery, BsRow } from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Dr/Cr tag ─────────────────────────────────────────────────────────────────
// normalBalance: the expected sign for a positive amount in this section
function DrCrTag({ amount, normalBalance }: { amount: number; normalBalance: 'DR' | 'CR' }) {
  if (amount === 0) return null;
  // if amount is negative the balance is opposite to normal
  const isDr = (amount > 0) === (normalBalance === 'DR');
  return (
    <span style={{
      marginLeft: 7, fontSize: 10, fontWeight: 700, padding: '1px 5px',
      borderRadius: 4,
      background: isDr ? '#dbeafe' : '#dcfce7',
      color:      isDr ? '#1d4ed8' : '#15803d',
    }}>
      {isDr ? 'Dr' : 'Cr'}
    </span>
  );
}

// ── Prior-year cell ───────────────────────────────────────────────────────────
// Rendered only when comparatives are switched on, so the default two-column
// layout is untouched.
function PrevCell({ show, amount, bold }: { show: boolean; amount: number | null; bold?: boolean }) {
  if (!show) return null;
  return (
    <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 12.5, fontWeight: bold ? 700 : 400, color: '#94a3b8' }}>
      {amount === null ? '—' : fmtAmt(amount)}
    </td>
  );
}

// ── Account row ───────────────────────────────────────────────────────────────
function BsAccountRow({ row, color, normalBalance, showPrev, prev }: {
  row: BsRow; color: string; normalBalance: 'DR' | 'CR';
  showPrev: boolean; prev: number | null;
}) {
  return (
    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
      <td style={{ padding: '8px 20px', color: '#475569', fontSize: 12.5 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 8 }}>{row.code}</span>
        {row.name}
        {row.sub_type && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>({row.sub_type})</span>}
      </td>
      <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 13, fontWeight: row.amount !== 0 ? 600 : 400, color: row.amount !== 0 ? color : '#94a3b8' }}>
        {row.amount !== 0 ? fmtAmt(row.amount) : '—'}
        <DrCrTag amount={row.amount} normalBalance={normalBalance} />
      </td>
      <PrevCell show={showPrev} amount={prev} />
    </tr>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, color, bg, showPrev, prevLabel }: {
  label: string; color: string; bg: string; showPrev: boolean; prevLabel: string;
}) {
  const hdr: CSSProperties = {
    padding: '8px 24px', textAlign: 'right', fontSize: 10.5, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  };
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: '8px 20px', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</td>
      <td style={{ ...hdr, color }}>Amount</td>
      {showPrev && <td style={{ ...hdr, color: '#94a3b8' }}>{prevLabel}</td>}
    </tr>
  );
}

// ── Total row ─────────────────────────────────────────────────────────────────
function TotalRow({ label, amount, color, showPrev, prev }: {
  label: string; amount: number; color: string; showPrev: boolean; prev: number | null;
}) {
  return (
    <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
      <td style={{ padding: '10px 20px', fontWeight: 700, fontSize: 13, color }}>{label}</td>
      <td style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 700, fontSize: 13, color }}>{fmtAmt(amount)}</td>
      <PrevCell show={showPrev} amount={prev} bold />
    </tr>
  );
}

// ── Spacer ────────────────────────────────────────────────────────────────────
function Spacer({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} style={{ height: 14 }} /></tr>;
}

export default function BalanceSheetPage() {
  const [asOf,      setAsOf]      = useState(todayStr());
  const [compare,   setCompare]   = useState(false);
  const [schedules, setSchedules] = useState(false);
  const [applied,   setApplied]   = useState<{ asOf: string; compare: boolean; schedules: boolean } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useGetBalanceSheetQuery(
    applied ?? { asOf: '' },
    { skip: !applied },
  );

  const bs       = data?.data;
  const prev     = bs?.previous ?? null;
  const showPrev = !!prev;
  const cols     = showPrev ? 3 : 2;
  const prevOf   = (code: string) => (prev ? (prev.byAccount[code] ?? 0) : null);

  const isBalanced = bs
    ? Math.abs(bs.totalAssets - bs.totalLiabilitiesAndEquity) < 0.01
    : null;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Balance Sheet</title><style>
        body { font-family: Arial, sans-serif; font-size: 12pt; color: #000; margin: 24pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6pt 10pt; }
        .right { text-align: right; }
        .title { text-align: center; margin-bottom: 18pt; }
        .balance-ok  { color: #15803d; font-weight: 700; }
        .balance-err { color: #dc2626; font-weight: 700; }
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

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Balance Sheet' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 780 }}>

        {/* Filter bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                As of Date
              </label>
              <input type="date" style={fc} value={asOf} onChange={e => setAsOf(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', paddingBottom: 8 }}>
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
              Previous year column
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', paddingBottom: 8 }}>
              <input type="checkbox" checked={schedules} onChange={e => setSchedules(e.target.checked)} />
              Include schedules
            </label>
            <button
              onClick={() => setApplied({ asOf, compare, schedules })}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Generate
            </button>
          </div>
        </div>

        {/* Statement */}
        {isLoading || isFetching ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Generating…</div>
        ) : !bs ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Select a date above and click Generate.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              {/* Balance indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
                color: isBalanced ? '#16a34a' : '#dc2626' }}>
                {isBalanced
                  ? <><span style={{ fontSize: 16 }}>✓</span> Balance Sheet is balanced</>
                  : <><span style={{ fontSize: 16 }}>✗</span> Out of balance — check journal entries</>
                }
              </div>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            {/* Printable body */}
            <div ref={printRef} style={{ padding: '0 0 8px' }}>
              {/* Title */}
              <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Balance Sheet
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  As at {fmtDate(bs.asOf)}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>

                  {/* ── ASSETS ── */}
                  <SectionHeader label="Assets" color="#1d4ed8" bg="#eff6ff" showPrev={showPrev} prevLabel={prev ? prev.asOf : ''} />
                  {bs.assets.length === 0
                    ? <tr><td colSpan={cols} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No asset accounts.</td></tr>
                    : bs.assets.map(r => <BsAccountRow key={r.id} row={r} color="#1d4ed8" normalBalance="DR" showPrev={showPrev} prev={prevOf(r.code)} />)
                  }
                  <TotalRow label="Total Assets" amount={bs.totalAssets} color="#1d4ed8" showPrev={showPrev} prev={prev ? prev.totalAssets : null} />

                  <Spacer cols={cols} />

                  {/* ── LIABILITIES ── */}
                  <SectionHeader label="Liabilities" color="#c2410c" bg="#fff7ed" showPrev={showPrev} prevLabel={prev ? prev.asOf : ''} />
                  {bs.liabilities.length === 0
                    ? <tr><td colSpan={cols} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No liability accounts.</td></tr>
                    : bs.liabilities.map(r => <BsAccountRow key={r.id} row={r} color="#c2410c" normalBalance="CR" showPrev={showPrev} prev={prevOf(r.code)} />)
                  }
                  <TotalRow label="Total Liabilities" amount={bs.totalLiabilities} color="#c2410c" showPrev={showPrev} prev={prev ? prev.totalLiabilities : null} />

                  <Spacer cols={cols} />

                  {/* ── EQUITY / FUNDS ── */}
                  <SectionHeader label="Funds & Equity" color="#7c3aed" bg="#f5f3ff" showPrev={showPrev} prevLabel={prev ? prev.asOf : ''} />
                  {bs.equity.length === 0 && bs.netSurplus === 0
                    ? <tr><td colSpan={cols} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No equity accounts.</td></tr>
                    : <>
                        {bs.equity.map(r => <BsAccountRow key={r.id} row={r} color="#7c3aed" normalBalance="CR" showPrev={showPrev} prev={prevOf(r.code)} />)}
                        {/* Net Surplus from P&L */}
                        <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 20px', color: '#475569', fontSize: 12.5, fontStyle: 'italic' }}>
                            Surplus / (Deficit) for the period
                          </td>
                          <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 13, fontWeight: 600,
                            color: bs.netSurplus >= 0 ? '#16a34a' : '#dc2626' }}>
                            {bs.netSurplus !== 0 ? fmtAmt(bs.netSurplus) : '—'}
                            {bs.netSurplus !== 0 && <DrCrTag amount={bs.netSurplus} normalBalance="CR" />}
                            {bs.netSurplus < 0 && <span style={{ marginLeft: 4, fontSize: 11 }}>(Deficit)</span>}
                          </td>
                          <PrevCell show={showPrev} amount={prev ? prev.netSurplus : null} />
                        </tr>
                      </>
                  }
                  <TotalRow label="Total Funds & Equity" amount={bs.totalEquity + bs.netSurplus} color="#7c3aed"
                            showPrev={showPrev} prev={prev ? prev.totalEquity + prev.netSurplus : null} />

                  {/* ── GRAND TOTAL CHECK ── */}
                  <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                      Total Liabilities + Funds
                    </td>
                    <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block', padding: '5px 16px', borderRadius: 8,
                        background: isBalanced ? '#dcfce7' : '#fee2e2',
                        color:      isBalanced ? '#15803d' : '#dc2626',
                        fontWeight: 700, fontSize: 15,
                      }}>
                        {fmtAmt(bs.totalLiabilitiesAndEquity)}
                      </div>
                    </td>
                    <PrevCell show={showPrev} amount={prev ? prev.totalLiabilitiesAndEquity : null} bold />
                  </tr>

                </tbody>
              </table>

              {/* ── SCHEDULES ── */}
              {bs.schedules && bs.schedules.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 18 }}>
                  {bs.schedules.map((sch, i) => (
                    <div key={sch.account.code} style={{ padding: '16px 0 4px' }}>
                      <div style={{ padding: '0 20px 8px', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        Schedule {i + 1} — {sch.account.name}
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{sch.account.code}</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <tbody>
                          {sch.rows.length === 0 ? (
                            <tr><td colSpan={2} style={{ padding: '8px 34px', color: '#94a3b8' }}>No balances.</td></tr>
                          ) : sch.rows.map(r => (
                            <tr key={r.code} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '6px 12px 6px 34px', color: r.code === '—' ? '#dc2626' : '#475569' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#cbd5e1', marginRight: 8 }}>{r.code}</span>
                                {r.name}
                              </td>
                              <td style={{ padding: '6px 24px', textAlign: 'right', fontWeight: 500, color: '#1e293b' }}>{fmtAmt(r.amount)}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <td style={{ padding: '8px 12px 8px 34px', fontWeight: 700, color: '#1e293b' }}>Total</td>
                            <td style={{ padding: '8px 24px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{fmtAmt(sch.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div style={{ padding: '10px 20px 4px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
                Generated from auto-posted and manual journal entries. All amounts in INR.
                {isBalanced
                  ? '  ✓ Assets = Liabilities + Funds.'
                  : '  ✗ Imbalance detected — journal entries may be incomplete.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
