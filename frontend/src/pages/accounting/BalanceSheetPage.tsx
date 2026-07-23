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

// ── Account row ───────────────────────────────────────────────────────────────
function BsAccountRow({ row, color }: { row: BsRow; color: string }) {
  return (
    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
      <td style={{ padding: '8px 20px', color: '#475569', fontSize: 12.5 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 8 }}>{row.code}</span>
        {row.name}
        {row.sub_type && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>({row.sub_type})</span>}
      </td>
      <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 13, fontWeight: row.amount !== 0 ? 600 : 400, color: row.amount !== 0 ? color : '#94a3b8' }}>
        {row.amount !== 0 ? fmtAmt(row.amount) : '—'}
      </td>
    </tr>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: '8px 20px', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</td>
      <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</td>
    </tr>
  );
}

// ── Total row ─────────────────────────────────────────────────────────────────
function TotalRow({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
      <td style={{ padding: '10px 20px', fontWeight: 700, fontSize: 13, color }}>{label}</td>
      <td style={{ padding: '10px 24px', textAlign: 'right', fontWeight: 700, fontSize: 13, color }}>{fmtAmt(amount)}</td>
    </tr>
  );
}

// ── Spacer ────────────────────────────────────────────────────────────────────
function Spacer() {
  return <tr><td colSpan={2} style={{ height: 14 }} /></tr>;
}

export default function BalanceSheetPage() {
  const [asOf,    setAsOf]    = useState(todayStr());
  const [applied, setApplied] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useGetBalanceSheetQuery(
    { asOf: applied ?? '' },
    { skip: !applied },
  );

  const bs = data?.data;

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
            <button
              onClick={() => setApplied(asOf)}
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
                  <SectionHeader label="Assets" color="#1d4ed8" bg="#eff6ff" />
                  {bs.assets.length === 0
                    ? <tr><td colSpan={2} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No asset accounts.</td></tr>
                    : bs.assets.map(r => <BsAccountRow key={r.id} row={r} color="#1d4ed8" />)
                  }
                  <TotalRow label="Total Assets" amount={bs.totalAssets} color="#1d4ed8" />

                  <Spacer />

                  {/* ── LIABILITIES ── */}
                  <SectionHeader label="Liabilities" color="#c2410c" bg="#fff7ed" />
                  {bs.liabilities.length === 0
                    ? <tr><td colSpan={2} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No liability accounts.</td></tr>
                    : bs.liabilities.map(r => <BsAccountRow key={r.id} row={r} color="#c2410c" />)
                  }
                  <TotalRow label="Total Liabilities" amount={bs.totalLiabilities} color="#c2410c" />

                  <Spacer />

                  {/* ── EQUITY / FUNDS ── */}
                  <SectionHeader label="Funds & Equity" color="#7c3aed" bg="#f5f3ff" />
                  {bs.equity.length === 0 && bs.netSurplus === 0
                    ? <tr><td colSpan={2} style={{ padding: '10px 20px', color: '#94a3b8', fontSize: 12.5 }}>No equity accounts.</td></tr>
                    : <>
                        {bs.equity.map(r => <BsAccountRow key={r.id} row={r} color="#7c3aed" />)}
                        {/* Net Surplus from P&L */}
                        <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 20px', color: '#475569', fontSize: 12.5, fontStyle: 'italic' }}>
                            Surplus / (Deficit) for the period
                          </td>
                          <td style={{ padding: '8px 24px', textAlign: 'right', fontSize: 13, fontWeight: 600,
                            color: bs.netSurplus >= 0 ? '#16a34a' : '#dc2626' }}>
                            {bs.netSurplus !== 0 ? fmtAmt(bs.netSurplus) : '—'}
                            {bs.netSurplus < 0 && <span style={{ marginLeft: 4, fontSize: 11 }}>(Deficit)</span>}
                          </td>
                        </tr>
                      </>
                  }
                  <TotalRow label="Total Funds & Equity" amount={bs.totalEquity + bs.netSurplus} color="#7c3aed" />

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
                  </tr>

                </tbody>
              </table>

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
