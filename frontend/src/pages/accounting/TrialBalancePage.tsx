import { useState, useRef, Fragment, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetTrialBalanceQuery, TrialBalanceRow } from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity',
  INCOME: 'Income', EXPENSE: 'Expenses',
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

// ── Rows ──────────────────────────────────────────────────────────────────────
function TbRow({ row }: { row: TrialBalanceRow }) {
  return (
    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
      <td style={{ padding: '8px 20px', color: '#475569', fontSize: 12.5 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 8 }}>{row.code}</span>
        {row.name}
      </td>
      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12.5, color: '#64748b' }}>
        {row.totalDebit !== 0 ? fmtAmt(row.totalDebit) : '—'}
      </td>
      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12.5, color: '#64748b' }}>
        {row.totalCredit !== 0 ? fmtAmt(row.totalCredit) : '—'}
      </td>
      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: row.debitBalance ? 600 : 400, color: row.debitBalance ? '#1d4ed8' : '#cbd5e1' }}>
        {row.debitBalance !== 0 ? fmtAmt(row.debitBalance) : '—'}
      </td>
      <td style={{ padding: '8px 20px', textAlign: 'right', fontSize: 13, fontWeight: row.creditBalance ? 600 : 400, color: row.creditBalance ? '#15803d' : '#cbd5e1' }}>
        {row.creditBalance !== 0 ? fmtAmt(row.creditBalance) : '—'}
      </td>
    </tr>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <tr style={{ background: '#f8fafc' }}>
      <td colSpan={5} style={{ padding: '7px 20px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </td>
    </tr>
  );
}

export default function TrialBalancePage() {
  const [asOf,    setAsOf]    = useState(todayStr());
  const [applied, setApplied] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useGetTrialBalanceQuery(
    { asOf: applied ?? '' },
    { skip: !applied },
  );

  const tb = data?.data;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Trial Balance</title><style>
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 24pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 5pt 8pt; }
        .title { text-align: center; margin-bottom: 18pt; }
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

  const th: CSSProperties = {
    padding: '9px 16px', textAlign: 'right', fontSize: 10.5, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Trial Balance' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 980 }}>

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

        {isLoading || isFetching ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Generating…</div>
        ) : !tb ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Select a date above and click Generate.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
                color: tb.isBalanced ? '#16a34a' : '#dc2626' }}>
                {tb.isBalanced
                  ? <><span style={{ fontSize: 16 }}>✓</span> Debits equal credits</>
                  : <><span style={{ fontSize: 16 }}>✗</span> Out of balance by {fmtAmt(tb.difference)}</>
                }
              </div>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            {/* Warnings */}
            {tb.warnings.length > 0 && (
              <div style={{ padding: '10px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                {tb.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#92400e', display: 'flex', gap: 6 }}>
                    <span>⚠</span><span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div ref={printRef} style={{ padding: '0 0 8px' }}>
              <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Trial Balance
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>As at {fmtDate(tb.asOf)}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', paddingLeft: 20 }}>Account</th>
                    <th style={th}>Total Debit</th>
                    <th style={th}>Total Credit</th>
                    <th style={th}>Dr Balance</th>
                    <th style={{ ...th, paddingRight: 20 }}>Cr Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.accounts.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      No posted entries as at this date.
                    </td></tr>
                  ) : TYPE_ORDER.map(type => {
                    const rows = tb.accounts.filter(a => a.type === type);
                    if (rows.length === 0) return null;
                    return (
                      <Fragment key={type}>
                        <GroupHeader label={TYPE_LABEL[type] ?? type} />
                        {rows.map(r => <TbRow key={r.id} row={r} />)}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '11px 20px', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Total</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{fmtAmt(tb.totalDebit)}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{fmtAmt(tb.totalCredit)}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>{fmtAmt(tb.totalDebitBalance)}</td>
                    <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#15803d' }}>{fmtAmt(tb.totalCreditBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
