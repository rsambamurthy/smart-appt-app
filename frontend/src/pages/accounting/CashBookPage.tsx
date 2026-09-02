import { useState, useRef, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetCashBookQuery, CashBookRow } from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Row({ row }: { row: CashBookRow }) {
  return (
    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
      <td style={{ padding: '8px 16px 8px 20px', fontSize: 12.5, color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</td>
      <td style={{ padding: '8px 12px', fontSize: 11.5, fontFamily: 'monospace', color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.reference_code}</td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#334155', whiteSpace: 'normal', wordBreak: 'break-word' }}>
        {row.particulars || '—'}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569', whiteSpace: 'normal', wordBreak: 'break-word' }}>
        {row.bp_name || '—'}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 12.5, color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word' }}>
        {row.narration}
      </td>
      <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 13, fontWeight: row.receipt ? 600 : 400, color: row.receipt ? '#15803d' : '#cbd5e1' }}>
        {row.receipt ? fmtAmt(row.receipt) : '—'}
      </td>
      <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 13, fontWeight: row.payment ? 600 : 400, color: row.payment ? '#dc2626' : '#cbd5e1' }}>
        {row.payment ? fmtAmt(row.payment) : '—'}
      </td>
      <td style={{ padding: '8px 20px 8px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: row.balance < 0 ? '#dc2626' : '#1e293b' }}>
        {fmtAmt(row.balance)}{row.balance < 0 && ' Cr'}
      </td>
    </tr>
  );
}

export default function CashBookPage() {
  const [kind, setKind] = useState<'CASH' | 'BANK'>('CASH');
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(todayStr());
  const [applied, setApplied] = useState<{ kind: 'CASH' | 'BANK'; from: string; to: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching, error } = useGetCashBookQuery(
    applied ?? { kind: 'CASH', from: '', to: '' },
    { skip: !applied },
  );

  const book = data?.data;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${kind === 'CASH' ? 'Cash Book' : 'Bank Book'}</title><style>
        body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; margin: 20pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4pt 7pt; }
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
  const th: CSSProperties = {
    padding: '9px 14px', textAlign: 'right', fontSize: 10.5, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: kind === 'CASH' ? 'Cash Book' : 'Bank Book' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1340 }}>

        {/* Filter bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Book</label>
              <select style={fc} value={kind} onChange={e => setKind(e.target.value as 'CASH' | 'BANK')}>
                <option value="CASH">Cash Book</option>
                <option value="BANK">Bank Book</option>
              </select>
            </div>
            <div>
              <label style={lbl}>From</label>
              <input type="date" style={fc} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>To</label>
              <input type="date" style={fc} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button
              onClick={() => setApplied({ kind, from, to })}
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
            {(error as { data?: { message?: string } })?.data?.message ?? 'Could not load the book.'}
          </div>
        ) : !book ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Choose a book and date range, then click Generate.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 6 }}>{book.account.code}</span>
                {book.account.name}
                <span style={{ marginLeft: 10, color: '#94a3b8' }}>· {book.rows.length} entries</span>
              </div>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            <div ref={printRef} style={{ padding: '0 0 8px' }}>
              <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {book.kind === 'CASH' ? 'Cash Book' : 'Bank Book'}
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {fmtDate(book.period.from)} to {fmtDate(book.period.to)}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', paddingLeft: 20 }}>Date</th>
                    <th style={{ ...th, textAlign: 'left' }}>Voucher</th>
                    <th style={{ ...th, textAlign: 'left' }}>Account Head</th>
                    <th style={{ ...th, textAlign: 'left' }}>Sub Ledger</th>
                    <th style={{ ...th, textAlign: 'left' }}>Particulars</th>
                    <th style={th}>Receipts</th>
                    <th style={th}>Payments</th>
                    <th style={{ ...th, paddingRight: 20 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td colSpan={7} style={{ padding: '8px 20px', fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
                      Opening Balance
                    </td>
                    <td style={{ padding: '8px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      {fmtAmt(book.openingBalance)}
                    </td>
                  </tr>
                  {book.rows.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      No transactions in this period.
                    </td></tr>
                  ) : book.rows.map(r => <Row key={r.id} row={r} />)}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <td colSpan={5} style={{ padding: '11px 20px', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                      Closing Balance
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#15803d' }}>{fmtAmt(book.totalReceipts)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>{fmtAmt(book.totalPayments)}</td>
                    <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: book.closingBalance < 0 ? '#dc2626' : '#1e293b' }}>
                      {fmtAmt(book.closingBalance)}{book.closingBalance < 0 && ' Cr'}
                    </td>
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
