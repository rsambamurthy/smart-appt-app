import { useState, useMemo, useRef, CSSProperties } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import InboxLayout, { InboxRow } from '../governance/InboxLayout';
import {
  useGetStatementSummaryQuery, useGetUnitStatementQuery,
} from '../../store/api/statementApi';
import { btn, field, label } from '../governance/meetingUi';

/**
 * Money is right-aligned, tabular-figured and always two decimals.
 * A column of amounts that does not line up is read as untrustworthy before
 * anyone checks whether it adds up.
 */
const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const amountCell: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── One flat's statement ──────────────────────────────────────────────────────

function UnitStatement({ unitId }: { unitId: string }) {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useGetUnitStatementQuery({ unitId, from, to });

  if (isLoading || !data) {
    return <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>;
  }

  const s = data.data;
  const owes = s.closing_balance > 0;

  // Printed from a fresh window rather than window.print(): the page around
  // this pane — navigation, filters, the flat list — has no place on a
  // statement handed to a resident.
  const print = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    const title = `Statement — Flat ${s.unit.flat_number}${s.unit.block ? ` ${s.unit.block}` : ''}`;
    win.document.write(`
      <html><head><title>${title}</title><style>
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 24pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 5pt 8pt; }
      </style></head><body>
        <h2 style="margin:0 0 2pt">${title}</h2>
        <div style="font-size:10pt;color:#444;margin-bottom:12pt">
          ${s.unit.resident ?? ''} &middot; ${fmtDate(s.period.from)} to ${fmtDate(s.period.to)}
        </div>
        ${content}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
              Flat {s.unit.flat_number}{s.unit.block ? ` · ${s.unit.block}` : ''}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
              {s.unit.resident ?? 'No resident on file'}
              {s.unit.phone && ` · ${s.unit.phone}`}
            </div>
          </div>
          <button onClick={print} style={{ ...btn, fontSize: 12.5 }}>Print</button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={label}>From</label>
            <input style={field} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={label}>To</label>
            <input style={field} type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }}
              style={{ ...btn, alignSelf: 'flex-end', fontSize: 12 }}>
              This financial year
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
          {fmtDate(s.period.from)} to {fmtDate(s.period.to)}
        </div>
      </div>

      <div ref={printRef}>
      {/* The four numbers that answer the question */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '13px 16px' }}>
        {[
          ['Opening', s.opening_balance, '#64748b'],
          ['Charged', s.charged, '#1e293b'],
          ['Paid', s.paid, '#15803d'],
        ].map(([t, v, c]) => (
          <div key={t as string} style={{ flex: '1 1 100px', background: '#f8fafc',
                                          borderRadius: 9, padding: '9px 12px' }}>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>{t as string}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c as string, ...amountCell,
                          textAlign: 'left' }}>
              ₹{money(v as number)}
            </div>
          </div>
        ))}
        <div style={{ flex: '1 1 120px', borderRadius: 9, padding: '9px 12px',
                      background: owes ? '#fef2f2' : '#f0fdf4' }}>
          <div style={{ fontSize: 11.5, color: owes ? '#b91c1c' : '#15803d' }}>
            {owes ? 'Outstanding' : s.closing_balance < 0 ? 'In credit' : 'Settled'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, ...amountCell, textAlign: 'left',
                        color: owes ? '#b91c1c' : '#15803d' }}>
            ₹{money(Math.abs(s.closing_balance))}
          </div>
        </div>
      </div>

      {s.penalty_charged > 0 && (
        <div style={{ padding: '0 16px 10px', fontSize: 12, color: '#92400e' }}>
          Includes ₹{money(s.penalty_charged)} of late-payment penalty.
        </div>
      )}

      {/* The ledger itself */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr>
              {['Date', 'Particulars', 'Charge', 'Payment', 'Balance'].map((h, i) => (
                <th key={h} style={{
                  fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                  letterSpacing: '0.05em', padding: '8px 12px',
                  borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                  textAlign: i >= 2 ? 'right' : 'left', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', fontSize: 12.5, color: '#94a3b8' }}>
                {fmtDate(s.period.from)}
              </td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#64748b' }}>
                Balance brought forward
              </td>
              <td /><td />
              <td style={{ ...amountCell, padding: '8px 12px', fontSize: 13, color: '#64748b' }}>
                {money(s.opening_balance)}
              </td>
            </tr>

            {s.lines.map((l, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f8fafc' }}>
                <td style={{ padding: '8px 12px', fontSize: 12.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                  {fmtDate(l.date)}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: '#1e293b' }}>
                  {l.description}
                  {l.reference && (
                    <span style={{ color: '#94a3b8' }}> · {l.reference}</span>
                  )}
                </td>
                <td style={{ ...amountCell, padding: '8px 12px', fontSize: 13 }}>
                  {l.kind === 'CHARGE' ? money(l.amount) : ''}
                </td>
                <td style={{ ...amountCell, padding: '8px 12px', fontSize: 13, color: '#15803d' }}>
                  {l.kind === 'PAYMENT' ? money(Math.abs(l.amount)) : ''}
                </td>
                <td style={{ ...amountCell, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
                  {money(l.balance)}
                </td>
              </tr>
            ))}

            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <td />
              <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                Closing balance
              </td>
              <td style={{ ...amountCell, padding: '9px 12px', fontSize: 13, fontWeight: 700 }}>
                {money(s.charged)}
              </td>
              <td style={{ ...amountCell, padding: '9px 12px', fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                {money(s.paid)}
              </td>
              <td style={{ ...amountCell, padding: '9px 12px', fontSize: 14, fontWeight: 700,
                           color: owes ? '#b91c1c' : '#15803d' }}>
                {money(s.closing_balance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>

      {s.lines.length === 0 && (
        <div style={{ padding: '18px 16px', fontSize: 13, color: '#94a3b8' }}>
          Nothing charged or paid in this period.
        </div>
      )}
    </div>
  );
}

// ── Resident's own statement ──────────────────────────────────────────────────
// The backend already lets a resident fetch their own unit; without this screen
// that permission would exist with nothing able to use it.

export function MyStatementPage() {
  const unitId = useSelector((s: RootState) => s.auth.user?.unit_id);

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues' }, { label: 'My Statement' }]} />
      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
                      overflow: 'hidden', maxWidth: 820 }}>
          {unitId ? (
            <UnitStatement unitId={unitId} />
          ) : (
            <div style={{ padding: '2rem', fontSize: 13.5, color: '#64748b' }}>
              Your login is not linked to a flat, so there is no statement to show.
              Ask the association office to link your account.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatementPage() {
  const [search, setSearch]     = useState('');
  const [owingOnly, setOwing]   = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useGetStatementSummaryQuery();

  const rows = data?.data ?? [];
  const t    = data?.totals;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (owingOnly && r.balance <= 0) return false;
      if (!q) return true;
      return r.flat_number.toLowerCase().includes(q)
          || (r.block ?? '').toLowerCase().includes(q);
    });
  }, [rows, search, owingOnly]);

  const toolbar = (
    <div style={{ padding: '9px 10px' }}>
      <input
        style={{ ...field, fontSize: 13, padding: '7px 9px', marginBottom: 8 }}
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Flat number" autoComplete="off"
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => setOwing(false)}
          style={{ padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5,
                   border: 'none', fontWeight: owingOnly ? 500 : 700,
                   background: owingOnly ? 'transparent' : '#eff6ff',
                   color: owingOnly ? '#64748b' : '#1d4ed8' }}>
          All {rows.length}
        </button>
        <button onClick={() => setOwing(true)}
          style={{ padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5,
                   border: 'none', fontWeight: owingOnly ? 700 : 500,
                   background: owingOnly ? '#fef2f2' : 'transparent',
                   color: owingOnly ? '#b91c1c' : '#64748b' }}>
          Owing {t?.flats_owing ?? 0}
        </button>
      </div>
    </div>
  );

  const list = isLoading ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
  ) : shown.length === 0 ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Nothing matches.</div>
  ) : (
    <>
      {shown.map(r => (
        <InboxRow
          key={r.id}
          selected={selected === r.id}
          accent={r.balance > 0 ? '#dc2626' : undefined}
          muted={r.balance === 0}
          title={r.flat_number + (r.block ? ` · ${r.block}` : '')}
          trailing={r.balance === 0 ? '—' : `₹${money(Math.abs(r.balance))}`}
          meta={r.balance > 0 ? 'Outstanding'
              : r.balance < 0 ? 'In credit'
              : 'Settled'}
          onClick={() => setSelected(r.id)}
        />
      ))}
    </>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues' }, { label: 'Statement of account' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        {t && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ flex: '1 1 150px', background: '#fef2f2', borderRadius: 10, padding: '11px 14px' }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: '#b91c1c', ...amountCell, textAlign: 'left' }}>
                ₹{money(t.outstanding)}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                Outstanding · {t.flats_owing} flats
              </div>
            </div>
            {t.in_credit > 0 && (
              <div style={{ flex: '1 1 150px', background: '#f0fdf4', borderRadius: 10, padding: '11px 14px' }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: '#15803d', ...amountCell, textAlign: 'left' }}>
                  ₹{money(t.in_credit)}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Paid in advance</div>
              </div>
            )}
          </div>
        )}

        <InboxLayout
          toolbar={toolbar}
          list={list}
          detail={selected ? <UnitStatement unitId={selected} /> : null}
          placeholder="Select a flat to see every charge and payment, with a running balance."
        />

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
          Credits are shown separately rather than netted against arrears — a flat
          that has paid ahead should not make the total owed look smaller than it is.
        </div>
      </div>
    </Layout>
  );
}
