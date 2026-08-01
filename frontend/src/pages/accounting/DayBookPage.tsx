import { useState, useRef, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDayBookQuery, DayBookEntry } from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const VOUCHER_COLOR: Record<string, string> = {
  RV: '#15803d', PV: '#dc2626', JV: '#7c3aed', CV: '#0891b2', DN: '#f59e0b', CN: '#f59e0b', BV: '#2563eb',
};

function VoucherTag({ type }: { type: string }) {
  const c = VOUCHER_COLOR[type] ?? '#64748b';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
      border: `1px solid ${c}33`, color: c, background: `${c}0d`, marginRight: 8,
    }}>
      {type}
    </span>
  );
}

function EntryBlock({ entry }: { entry: DayBookEntry }) {
  return (
    <div style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, color: '#1e293b' }}>
          <VoucherTag type={entry.voucher_type} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 8 }}>{entry.reference_code}</span>
          {entry.narration}
          {entry.source === 'AUTO' && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 3, padding: '0 4px' }}>auto</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', marginLeft: 12 }}>
          {fmtAmt(entry.totalDebit)}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {entry.lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 0 3px 22px', color: '#475569' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#cbd5e1', marginRight: 7 }}>{l.account_code}</span>
                {l.account_name}
                {l.bp_name && <span style={{ marginLeft: 6, color: '#94a3b8' }}>· {l.bp_name}</span>}
              </td>
              <td style={{ padding: '3px 14px', textAlign: 'right', width: 130, color: l.debit ? '#1d4ed8' : '#e2e8f0', fontWeight: l.debit ? 600 : 400 }}>
                {l.debit ? fmtAmt(l.debit) : '—'}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'right', width: 130, color: l.credit ? '#15803d' : '#e2e8f0', fontWeight: l.credit ? 600 : 400 }}>
                {l.credit ? fmtAmt(l.credit) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DayBookPage() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(todayStr());
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useGetDayBookQuery(
    applied ?? { from: '', to: '' },
    { skip: !applied },
  );

  const db = data?.data;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Day Book</title><style>
        body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; margin: 20pt; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3pt 6pt; }
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
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Day Book' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 900 }}>

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
        ) : !db ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Choose a date range and click Generate.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                {db.entryCount} {db.entryCount === 1 ? 'entry' : 'entries'} · {fmtAmt(db.grandTotal)} total
              </div>
              <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            <div ref={printRef}>
              <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Day Book
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {db.period.from} to {db.period.to}
                </div>
              </div>

              {db.days.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No posted entries in this period.
                </div>
              ) : db.days.map(day => (
                <div key={day.date}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '8px 20px', background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {fmtDate(day.date)}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>
                      {fmtAmt(day.totalDebit)}
                    </span>
                  </div>
                  {day.entries.map(e => <EntryBlock key={e.id} entry={e} />)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
