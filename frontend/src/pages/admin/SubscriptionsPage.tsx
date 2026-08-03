import { useState, useEffect, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListSubscriptionsQuery, useGrantModuleMutation, useCancelModuleMutation,
  ModuleKey, ModuleEntitlement, SubscriptionStatus, SubscriptionFilter,
} from '../../store/api/subscriptionsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODULES: ModuleKey[] = ['ACCOUNTING', 'GOVERNANCE'];

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';

const today = () => new Date().toISOString().slice(0, 10);

const plusMonths = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const FILTERS: { id: SubscriptionFilter; label: string }[] = [
  { id: 'ALL',          label: 'All' },
  { id: 'EXPIRING',     label: 'Expiring soon' },
  { id: 'LAPSED',       label: 'Lapsed' },
  { id: 'TRIAL',        label: 'On trial' },
  { id: 'UNSUBSCRIBED', label: 'Never subscribed' },
];

/** Compact state for one module, sized to sit in a table cell. */
function ModuleCell({ m, onEdit }: { m: ModuleEntitlement; onEdit: () => void }) {
  const look =
    m.access === 'NONE'        ? { label: '—',         bg: 'transparent', fg: '#cbd5e1', border: 'transparent' }
    : m.access === 'READ_ONLY' ? { label: m.status === 'CANCELLED' ? 'Cancelled' : 'Lapsed', bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' }
    : m.status === 'TRIAL'     ? { label: 'Trial',     bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' }
    : m.expiring_soon          ? { label: 'Expiring',  bg: '#fffbeb', fg: '#92400e', border: '#fcd34d' }
    : { label: 'Active', bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' };

  const sub =
    m.access === 'NONE'                       ? 'Not subscribed'
    : m.expires_on === null                   ? 'Perpetual'
    : m.days_left !== null && m.days_left >= 0 ? `${m.days_left}d · ${fmtDate(m.expires_on)}`
    : `since ${fmtDate(m.expires_on)}`;

  return (
    <button
      onClick={onEdit}
      title={`${m.name} — click to change`}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', padding: '5px 8px',
        background: look.bg, border: `1px solid ${look.border}`, borderRadius: 7,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: look.fg }}>{look.label}</div>
      <div style={{ fontSize: 10.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{sub}</div>
    </button>
  );
}

const btn: CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', minHeight: 36,
};
const inp: CSSProperties = {
  padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13.5, width: '100%',
};
const th: CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', padding: '9px 12px',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};
const td: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };

// ── Grant / renew ─────────────────────────────────────────────────────────────

function GrantRow({ associationId, associationName, module, current, onDone }: {
  associationId: string; associationName: string; module: ModuleKey;
  current: ModuleEntitlement; onDone: () => void;
}) {
  const [grant, { isLoading }] = useGrantModuleMutation();
  const [cancelModule] = useCancelModuleMutation();
  const [status, setStatus]       = useState<SubscriptionStatus>(current.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE');
  const [startsOn, setStartsOn]   = useState(today());
  const [expiresOn, setExpiresOn] = useState(plusMonths(12));
  const [perpetual, setPerpetual] = useState(current.expires_on === null && current.status !== null);
  const [amount, setAmount]       = useState('');
  const [reference, setReference] = useState('');
  const [error, setError]         = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await grant({
        associationId, module, status,
        starts_on:  startsOn,
        expires_on: perpetual ? null : expiresOn,
        amount:     amount ? Number(amount) : null,
        reference:  reference || null,
      }).unwrap();
      onDone();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; message?: string } };
      setError(err?.data?.detail ?? err?.data?.message ?? 'Could not save.');
    }
  };

  const stop = async () => {
    if (!window.confirm(
      `Stop ${current.name} for ${associationName}?\n\n` +
      `They keep access to existing records but cannot make new entries or ` +
      `generate reports until it is renewed.`
    )) return;
    await cancelModule({ associationId, module });
    onDone();
  };

  return (
    <tr>
      <td colSpan={MODULES.length + 2} style={{ padding: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ padding: '13px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
            {associationName} · {current.name}
          </div>

          {error && (
            <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 1 110px' }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Type</label>
              <select style={inp} value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)}>
                <option value="ACTIVE">Paid</option>
                <option value="TRIAL">Trial</option>
              </select>
            </div>
            <div style={{ flex: '0 1 145px' }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Starts</label>
              <input style={inp} type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} />
            </div>
            <div style={{ flex: '0 1 145px' }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Expires</label>
              <input style={{ ...inp, opacity: perpetual ? 0.4 : 1 }} type="date" value={expiresOn}
                     disabled={perpetual} onChange={e => setExpiresOn(e.target.value)} />
            </div>
            <div style={{ flex: '0 1 110px' }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Amount (₹)</label>
              <input style={inp} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 3 }}>Reference</label>
              <input style={inp} value={reference} onChange={e => setReference(e.target.value)} placeholder="Invoice no." />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 12.5, color: '#475569' }}>
            <input type="checkbox" checked={perpetual} onChange={e => setPerpetual(e.target.checked)} />
            Perpetual — never expires, never asked to renew
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
            <button onClick={submit} disabled={isLoading}
              style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
              {isLoading ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onDone}
              style={{ ...btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1' }}>
              Cancel
            </button>
            {current.access !== 'NONE' && current.status !== 'CANCELLED' && (
              <button onClick={stop}
                style={{ ...btn, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', marginLeft: 'auto' }}>
                Stop subscription
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [search, setSearch]   = useState('');
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState<SubscriptionFilter>('ALL');
  const [page, setPage]       = useState(1);
  const [editing, setEditing] = useState<string | null>(null);

  // Debounced: typing a name should not fire a query per keystroke once there
  // are hundreds of associations.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = useListSubscriptionsQuery({ q, filter, page, limit: 25 });

  const rows    = data?.data ?? [];
  const meta    = data?.meta;
  const summary = data?.summary;

  const tiles = [
    { label: 'Active',        n: summary?.active   ?? 0, colour: '#15803d', bg: '#f0fdf4', filter: 'ALL'      as SubscriptionFilter },
    { label: 'On trial',      n: summary?.trial    ?? 0, colour: '#1d4ed8', bg: '#eff6ff', filter: 'TRIAL'    as SubscriptionFilter },
    { label: 'Expiring 30d',  n: summary?.expiring ?? 0, colour: '#92400e', bg: '#fffbeb', filter: 'EXPIRING' as SubscriptionFilter },
    { label: 'Lapsed',        n: summary?.lapsed   ?? 0, colour: '#b91c1c', bg: '#fef2f2', filter: 'LAPSED'   as SubscriptionFilter },
  ];

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Administration' }, { label: 'Subscriptions' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>

        {/* Counts are across every association, not the filtered page — this is
            a dashboard, not a description of the current filter. */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {tiles.map(t => (
            <button key={t.label} onClick={() => { setFilter(t.filter); setPage(1); }}
              style={{
                flex: '1 1 130px', padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                background: t.bg, border: `1px solid ${filter === t.filter ? t.colour : 'transparent'}`,
                textAlign: 'left',
              }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: t.colour }}>{t.n}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input
            style={{ ...inp, flex: '1 1 260px', maxWidth: 340 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search association or city"
            autoComplete="off"
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => { setFilter(f.id); setPage(1); }}
                style={{
                  padding: '7px 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5, minHeight: 34,
                  fontWeight: filter === f.id ? 700 : 500,
                  border: `1px solid ${filter === f.id ? '#2563eb' : '#cbd5e1'}`,
                  background: filter === f.id ? '#eff6ff' : '#fff',
                  color:      filter === f.id ? '#1d4ed8' : '#475569',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '40%' }}>Association</th>
                {MODULES.map(m => (
                  <th key={m} style={{ ...th, width: 150 }}>
                    {m === 'ACCOUNTING' ? 'Accounting' : 'Governance'}
                  </th>
                ))}
                <th style={{ ...th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={MODULES.length + 2} style={{ ...td, color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={MODULES.length + 2} style={{ ...td, color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
                  {q || filter !== 'ALL' ? 'No associations match.' : 'No associations yet.'}
                </td></tr>
              ) : rows.map(a => {
                const openKey = editing?.startsWith(`${a.id}:`) ? editing.split(':')[1] as ModuleKey : null;
                const openMod = openKey ? a.modules.find(m => m.module === openKey) : null;

                return [
                  <tr key={a.id}>
                    <td style={td}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{a.name}</div>
                      {a.city && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{a.city}</div>}
                    </td>
                    {MODULES.map(key => {
                      const m = a.modules.find(x => x.module === key);
                      if (!m) return <td key={key} style={td} />;
                      return (
                        <td key={key} style={td}>
                          <ModuleCell m={m} onEdit={() =>
                            setEditing(editing === `${a.id}:${key}` ? null : `${a.id}:${key}`)} />
                        </td>
                      );
                    })}
                    <td style={{ ...td, color: '#cbd5e1', fontSize: 16, textAlign: 'center' }}>
                      {openKey ? '▾' : ''}
                    </td>
                  </tr>,
                  openMod ? (
                    <GrantRow
                      key={`${a.id}-edit`}
                      associationId={a.id}
                      associationName={a.name}
                      module={openMod.module}
                      current={openMod}
                      onDone={() => setEditing(null)}
                    />
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>

        {/* Paging */}
        {meta && meta.pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button disabled={page <= 1 || isFetching} onClick={() => setPage(p => p - 1)}
              style={{ ...btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
                       opacity: page <= 1 ? 0.4 : 1 }}>
              Previous
            </button>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Page {meta.page} of {meta.pages} · {meta.total} associations
            </span>
            <button disabled={page >= meta.pages || isFetching} onClick={() => setPage(p => p + 1)}
              style={{ ...btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
                       opacity: page >= meta.pages ? 0.4 : 1 }}>
              Next
            </button>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 14, maxWidth: 720 }}>
          New associations start on a {data?.trial_days ?? 90}-day trial of every module.
          When a subscription ends they keep seeing their records but cannot make
          entries or produce reports. Nothing is ever deleted.
        </div>
      </div>
    </Layout>
  );
}
