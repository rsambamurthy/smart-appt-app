import { useState, useRef, Fragment, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetReceiptsPaymentsQuery, RPRow, RPBalance } from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Indian financial year: 1 April to 31 March.
function fyStart() {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function AmountRow({ label, sub, amount, indent = false, muted = false }: {
  label: string; sub?: string; amount: number; indent?: boolean; muted?: boolean;
}) {
  return (
    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
      <td style={{ padding: `7px 12px 7px ${indent ? 34 : 20}px`, fontSize: 12.5, color: muted ? '#94a3b8' : '#475569' }}>
        {sub && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#cbd5e1', marginRight: 8 }}>{sub}</span>}
        {label}
      </td>
      <td style={{ padding: '7px 20px 7px 12px', textAlign: 'right', fontSize: 12.5, fontWeight: 500, color: muted ? '#94a3b8' : '#1e293b' }}>
        {fmtAmt(amount)}
      </td>
    </tr>
  );
}

function SideHeader({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <tr style={{ background: bg }}>
      <td colSpan={2} style={{ padding: '8px 20px', fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </td>
    </tr>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} style={{ padding: '9px 20px 4px', fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
        {label}
      </td>
    </tr>
  );
}

// One side of the statement. Each side is two sections: on the receipts side
// the opening balance then what came in; on the payments side what went out
// then the closing balance. Both sides must total to the same figure.
interface Section {
  label: string;
  rows:  (RPRow | RPBalance)[];
  total: number;
}

function Side({ title, color, bg, sections, total }: {
  title: string; color: string; bg: string; sections: Section[]; total: number;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        <SideHeader label={title} color={color} bg={bg} />

        {sections.map(sec => (
          <Fragment key={sec.label}>
            <GroupLabel label={sec.label} />
            {sec.rows.length === 0 ? (
              <tr><td colSpan={2} style={{ padding: '10px 34px', fontSize: 12.5, color: '#94a3b8' }}>None in this period.</td></tr>
            ) : sec.rows.map(r => (
              <AmountRow key={r.code} label={r.name} sub={r.code} amount={r.amount} indent muted={r.amount === 0} />
            ))}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 12px 6px 34px', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Sub-total</td>
              <td style={{ padding: '6px 20px 6px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569' }}>{fmtAmt(sec.total)}</td>
            </tr>
          </Fragment>
        ))}

        <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
          <td style={{ padding: '11px 20px', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Total</td>
          <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color }}>{fmtAmt(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function ReceiptsPaymentsPage() {
  const [from, setFrom] = useState(fyStart());
  const [to,   setTo]   = useState(todayStr());
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching, error } = useGetReceiptsPaymentsQuery(
    applied ?? { from: '', to: '' },
    { skip: !applied },
  );

  const rp = data?.data;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipts and Payments Account</title><style>
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

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Receipts & Payments' }]} />

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
            <button
              onClick={() => setApplied({ from, to })}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Generate
            </button>
          </div>
        </div>

        {isLoading || isFetching ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Generating…</div>
        ) : error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#b91c1c', fontSize: 13 }}>
            {(error as { data?: { message?: string } })?.data?.message ?? 'Could not generate the statement.'}
          </div>
        ) : !rp ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Choose a period and click Generate. Defaults to the current financial year.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
                color: rp.isReconciled ? '#16a34a' : '#dc2626' }}>
                {rp.isReconciled
                  ? <><span style={{ fontSize: 16 }}>✓</span> Reconciles to the closing cash balance</>
                  : <><span style={{ fontSize: 16 }}>✗</span> Off by {fmtAmt(rp.difference)} against closing cash</>
                }
              </div>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            {rp.contraEntriesExcluded > 0 && (
              <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: 11.5, color: '#64748b' }}>
                {rp.contraEntriesExcluded} contra {rp.contraEntriesExcluded === 1 ? 'entry' : 'entries'} excluded —
                transfers between cash and bank are not receipts or payments.
              </div>
            )}

            <div ref={printRef}>
              <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Receipts and Payments Account
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  For the period {fmtDate(rp.period.from)} to {fmtDate(rp.period.to)}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ flex: '1 1 420px', borderRight: '1px solid #f1f5f9' }}>
                  <Side
                    title="Receipts" color="#15803d" bg="#f0fdf4"
                    sections={[
                      { label: 'Opening Balance',            rows: rp.openingBalances, total: rp.openingTotal  },
                      { label: 'Received during the period', rows: rp.receipts,        total: rp.totalReceipts },
                    ]}
                    total={rp.totalLeft}
                  />
                </div>
                <div style={{ flex: '1 1 420px' }}>
                  <Side
                    title="Payments" color="#dc2626" bg="#fef2f2"
                    sections={[
                      { label: 'Paid during the period', rows: rp.payments,        total: rp.totalPayments },
                      { label: 'Closing Balance',        rows: rp.closingBalances, total: rp.closingTotal  },
                    ]}
                    total={rp.totalRight}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
