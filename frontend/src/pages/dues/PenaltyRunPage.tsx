import { useState, useMemo, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  usePreviewPenaltiesQuery, useApplyPenaltiesMutation,
  useUnitPenaltiesQuery, useWaivePenaltyMutation,
  PenaltyCandidate,
} from '../../store/api/penaltyApi';
import { btn, field, label } from '../governance/meetingUi';

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const amountCell: CSSProperties = {
  fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap',
};

const th: CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', padding: '9px 12px', textAlign: 'left',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};

const td: CSSProperties = { padding: '9px 12px', fontSize: 13, color: '#1e293b' };

// ── Waiver ────────────────────────────────────────────────────────────────────

function WaiveBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [waive, { isLoading, error }] = useWaivePenaltyMutation();

  const submit = async () => {
    try {
      await waive({ id, reason }).unwrap();
      onDone();
    } catch { /* surfaced below */ }
  };

  const msg = error && 'data' in error
    ? ((error.data as { message?: string })?.message ?? 'Could not waive.')
    : null;

  return (
    <div style={{ background: '#fffbeb', borderRadius: 9, padding: '11px 13px', marginTop: 8 }}>
      <label style={label}>Why is this being waived?</label>
      <textarea
        style={{ ...field, minHeight: 62, resize: 'vertical' }}
        value={reason} onChange={e => setReason(e.target.value)}
        placeholder="e.g. Resident was hospitalised; committee approved on 12 Aug"
      />
      <div style={{ fontSize: 11.5, color: '#92400e', marginBottom: 8 }}>
        This reverses the full penalty and posts a credit note. Both the original
        charge and this reversal stay on the ledger.
      </div>
      {msg && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', marginBottom: 8 }}>{msg}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={isLoading || reason.trim().length < 5}
          style={{ ...btn, background: '#b45309', color: '#fff', borderColor: '#b45309',
                   opacity: reason.trim().length < 5 ? 0.5 : 1 }}>
          {isLoading ? 'Waiving…' : 'Waive penalty'}
        </button>
        <button onClick={onDone} style={btn}>Cancel</button>
      </div>
    </div>
  );
}

// ── History for one flat ──────────────────────────────────────────────────────

function UnitHistory({ unitId, flat }: { unitId: string; flat: string }) {
  const { data, isLoading } = useUnitPenaltiesQuery(unitId);
  const [waiving, setWaiving] = useState<string | null>(null);

  if (isLoading) return <div style={{ padding: 14, color: '#94a3b8', fontSize: 13 }}>Loading…</div>;
  const rows = data?.data ?? [];

  if (!rows.length) {
    return (
      <div style={{ padding: 14, color: '#94a3b8', fontSize: 13 }}>
        Flat {flat} has never been penalised.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 14px 14px' }}>
      {rows.map(r => (
        <div key={r.id} style={{
          borderTop: '1px solid #f1f5f9', padding: '11px 0',
          opacity: r.waived ? 0.75 : 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                {r.period}
                {r.waived && (
                  <span style={{ marginLeft: 7, padding: '1px 7px', borderRadius: 99,
                                 background: '#f1f5f9', color: '#64748b',
                                 fontSize: 10.5, fontWeight: 700 }}>
                    WAIVED
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                {r.days_overdue} days overdue · charged {fmtDate(r.charged_on)} by {r.charged_by}
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{r.basis}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...amountCell, fontSize: 15, fontWeight: 700,
                            color: r.waived ? '#94a3b8' : '#b91c1c',
                            textDecoration: r.waived ? 'line-through' : 'none' }}>
                ₹{money(r.amount)}
              </div>
              {!r.waived && waiving !== r.id && (
                <button onClick={() => setWaiving(r.id)}
                  style={{ ...btn, fontSize: 11.5, padding: '3px 9px', marginTop: 4 }}>
                  Waive
                </button>
              )}
            </div>
          </div>

          {r.waived && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 5,
                          background: '#f8fafc', borderRadius: 7, padding: '7px 10px' }}>
              Waived {r.waived_on && fmtDate(r.waived_on)} by {r.waived_by}: {r.waive_reason}
            </div>
          )}

          {waiving === r.id && <WaiveBox id={r.id} onDone={() => setWaiving(null)} />}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PenaltyRunPage() {
  const [asOf, setAsOf]         = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [openUnit, setOpenUnit] = useState<{ id: string; flat: string } | null>(null);
  const [result, setResult]     = useState<null | { charged: number; amount: number; skipped: Array<{ flat_number: string; reason: string }> }>(null);

  const { data, isLoading, refetch } = usePreviewPenaltiesQuery(asOf ? { as_of: asOf } : undefined);
  const [apply, { isLoading: applying }] = useApplyPenaltiesMutation();

  const rows = useMemo(() => data?.data ?? [], [data]);
  const selected = useMemo(
    () => rows.filter(r => !excluded.has(r.bill_id)),
    [rows, excluded],
  );
  const selectedTotal = selected.reduce((s, r) => s + r.penalty, 0);

  const toggle = (id: string) => setExcluded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const run = async () => {
    const res = await apply({
      bill_ids: selected.map(r => r.bill_id),
      as_of: asOf || undefined,
    }).unwrap();
    setResult({
      charged: res.totals.charged,
      amount:  res.totals.amount,
      skipped: res.skipped.map(s => ({ flat_number: s.flat_number, reason: s.reason })),
    });
    setExcluded(new Set());
    refetch();
  };

  const cfg = data?.config;
  const basis = cfg
    ? cfg.penalty_type === 'FLAT'
      ? `₹${money(cfg.penalty_value)} per overdue bill, after ${cfg.grace_days} days' grace`
      : `${cfg.penalty_value}% of the bill, after ${cfg.grace_days} days' grace`
    : null;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues' }, { label: 'Late Payment Penalty' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 1040 }}>

        {result && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
                        padding: '12px 15px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>
              Charged {result.charged} {result.charged === 1 ? 'bill' : 'bills'} · ₹{money(result.amount)}
            </div>
            {result.skipped.length > 0 && (
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6 }}>
                {result.skipped.length} skipped:{' '}
                {result.skipped.slice(0, 6).map(s => `${s.flat_number} (${s.reason})`).join('; ')}
                {result.skipped.length > 6 && ` and ${result.skipped.length - 6} more`}
              </div>
            )}
            <button onClick={() => setResult(null)}
              style={{ ...btn, fontSize: 11.5, padding: '3px 9px', marginTop: 8 }}>
              Dismiss
            </button>
          </div>
        )}

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
                      overflow: 'hidden' }}>

          <div style={{ padding: '13px 15px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: '#1e293b' }}>
                  Bills eligible for penalty
                </div>
                {basis && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{basis}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div>
                  <label style={label}>As at</label>
                  <input style={{ ...field, width: 150 }} type="date"
                    value={asOf} onChange={e => setAsOf(e.target.value)} />
                </div>
                <button
                  onClick={run}
                  disabled={applying || selected.length === 0}
                  style={{ ...btn, background: selected.length ? '#b91c1c' : '#e2e8f0',
                           color: selected.length ? '#fff' : '#94a3b8',
                           borderColor: selected.length ? '#b91c1c' : '#e2e8f0',
                           fontWeight: 700 }}>
                  {applying ? 'Charging…'
                    : `Charge ${selected.length} · ₹${money(selectedTotal)}`}
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '2rem 1rem', color: '#64748b', fontSize: 13.5 }}>
              Nothing is overdue beyond the grace period. Bills that already carry a
              live penalty are excluded — a bill is penalised once.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 34 }} />
                    <th style={th}>Flat</th>
                    <th style={th}>Period</th>
                    <th style={th}>Due</th>
                    <th style={{ ...th, textAlign: 'right' }}>Overdue</th>
                    <th style={{ ...th, textAlign: 'right' }}>Outstanding</th>
                    <th style={{ ...th, textAlign: 'right' }}>Penalty</th>
                    <th style={{ ...th, width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: PenaltyCandidate) => {
                    const off = excluded.has(r.bill_id);
                    return (
                      <tr key={r.bill_id} style={{ borderTop: '1px solid #f8fafc',
                                                   opacity: off ? 0.45 : 1 }}>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input type="checkbox" checked={!off}
                            onChange={() => toggle(r.bill_id)} />
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {r.flat_number}{r.block ? ` · ${r.block}` : ''}
                          {r.resident && (
                            <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 400 }}>
                              {r.resident}
                            </div>
                          )}
                        </td>
                        <td style={td}>{r.period}</td>
                        <td style={{ ...td, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {fmtDate(r.due_date)}
                        </td>
                        <td style={{ ...td, ...amountCell,
                                     color: r.days_overdue > 60 ? '#b91c1c' : '#b45309',
                                     fontWeight: 600 }}>
                          {r.days_overdue}d
                        </td>
                        <td style={{ ...td, ...amountCell }}>{money(r.outstanding)}</td>
                        <td style={{ ...td, ...amountCell, fontWeight: 700, color: '#b91c1c' }}>
                          {money(r.penalty)}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button
                            onClick={() => setOpenUnit(
                              openUnit?.id === r.unit_id
                                ? null
                                : { id: r.unit_id, flat: r.flat_number })}
                            title="Penalty history for this flat"
                            style={{ ...btn, fontSize: 11, padding: '2px 7px' }}>
                            ⋯
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {openUnit && (
            <div style={{ borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
              <div style={{ padding: '10px 14px 0', fontSize: 12.5,
                            fontWeight: 700, color: '#64748b' }}>
                Penalty history — Flat {openUnit.flat}
              </div>
              <UnitHistory unitId={openUnit.id} flat={openUnit.flat} />
            </div>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14,
                      maxWidth: 700, lineHeight: 1.65 }}>
          A bill attracts a penalty once, not every month it stays unpaid — recurring
          interest is how a ₹2,500 arrear quietly becomes uncollectable. Charging posts
          a debit note to Penalty Income; waiving posts a credit note reversing it, and
          both entries remain on the ledger. Unticking a row here simply leaves that
          bill alone; nothing is recorded about the exclusion.
        </div>
      </div>
    </Layout>
  );
}
