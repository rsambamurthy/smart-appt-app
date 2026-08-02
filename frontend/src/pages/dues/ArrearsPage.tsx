import { useRef, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetArrearsQuery, ArrearsRow } from '../../store/api/duesApi';

const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Ageing buckets ────────────────────────────────────────────────────────────
// Standard receivables ageing. ageing_days is the OLDEST unpaid bill for the
// flat, so a flat sits in the bucket of its longest-overdue amount.
const BUCKETS = [
  { id: '0',   label: 'Not yet due', min: -99999, max: 0,     color: '#64748b', bg: '#f8fafc' },
  { id: '30',  label: '1–30 days',   min: 1,      max: 30,    color: '#15803d', bg: '#f0fdf4' },
  { id: '60',  label: '31–60 days',  min: 31,     max: 60,    color: '#b45309', bg: '#fffbeb' },
  { id: '90',  label: '61–90 days',  min: 61,     max: 90,    color: '#c2410c', bg: '#fff7ed' },
  { id: '90+', label: 'Over 90 days', min: 91,    max: 99999, color: '#dc2626', bg: '#fef2f2' },
];

function bucketFor(days: number) {
  return BUCKETS.find(b => days >= b.min && days <= b.max) ?? BUCKETS[0];
}

export default function ArrearsPage() {
  const { data, isLoading, error } = useGetArrearsQuery();
  const printRef = useRef<HTMLDivElement>(null);

  const rows: ArrearsRow[] = (data?.data ?? []).map(r => ({
    ...r,
    outstanding: Number(r.outstanding),
    ageing_days: Number(r.ageing_days),
    penalty:     Number(r.penalty),
  }));

  const total   = rows.reduce((s, r) => s + r.outstanding, 0);
  const penalty = rows.reduce((s, r) => s + r.penalty, 0);

  const bucketTotals = BUCKETS.map(b => ({
    ...b,
    amount: rows.filter(r => bucketFor(r.ageing_days).id === b.id)
                .reduce((s, r) => s + r.outstanding, 0),
    count:  rows.filter(r => bucketFor(r.ageing_days).id === b.id).length,
  }));

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Arrears</title><style>
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 24pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 5pt 8pt; text-align: left; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const th: CSSProperties = {
    padding: '9px 16px', textAlign: 'right', fontSize: 10.5, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues & Payments' }, { label: 'Arrears' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 900 }}>

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Loading…</div>
        ) : error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#b91c1c', fontSize: 13 }}>
            Could not load arrears.
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '20px 24px', color: '#15803d', fontSize: 13.5, fontWeight: 500 }}>
            ✓ No arrears — every bill is fully paid.
          </div>
        ) : (
          <>
            {/* Ageing summary */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {bucketTotals.filter(b => b.count > 0).map(b => (
                <div key={b.id} style={{
                  flex: '1 1 150px', background: b.bg, border: `1px solid ${b.color}22`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {b.label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                    {fmtAmt(b.amount)}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                    {b.count} {b.count === 1 ? 'flat' : 'flats'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12.5, color: '#475569' }}>
                  {rows.length} {rows.length === 1 ? 'flat' : 'flats'} owing {fmtAmt(total)}
                  {penalty > 0 && <span style={{ color: '#94a3b8' }}> · includes {fmtAmt(penalty)} penalty</span>}
                </div>
                <button onClick={handlePrint} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
                </button>
              </div>

              <div ref={printRef}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left', paddingLeft: 20 }}>Flat</th>
                      <th style={{ ...th, textAlign: 'left' }}>Ageing</th>
                      <th style={th}>Penalty</th>
                      <th style={{ ...th, paddingRight: 20 }}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const b = bucketFor(r.ageing_days);
                      return (
                        <tr key={r.unit_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '9px 16px 9px 20px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                            {r.flat_number}
                          </td>
                          <td style={{ padding: '9px 16px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                              background: b.bg, color: b.color,
                            }}>
                              {r.ageing_days <= 0 ? 'Not yet due' : `${r.ageing_days} days`}
                            </span>
                          </td>
                          <td style={{ padding: '9px 16px', textAlign: 'right', fontSize: 12.5, color: r.penalty ? '#c2410c' : '#cbd5e1' }}>
                            {r.penalty ? fmtAmt(r.penalty) : '—'}
                          </td>
                          <td style={{ padding: '9px 20px 9px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                            {fmtAmt(r.outstanding)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <td colSpan={2} style={{ padding: '11px 20px', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Total</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#c2410c' }}>
                        {penalty ? fmtAmt(penalty) : '—'}
                      </td>
                      <td style={{ padding: '11px 20px 11px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>
                        {fmtAmt(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
