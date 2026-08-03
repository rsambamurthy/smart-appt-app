import { useState, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListSubscriptionsQuery, useGrantModuleMutation, useCancelModuleMutation,
  ModuleKey, ModuleEntitlement, SubscriptionStatus,
} from '../../store/api/subscriptionsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const today = () => new Date().toISOString().slice(0, 10);

const plusMonths = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

/** What the association sees, said plainly. */
function AccessPill({ m }: { m: ModuleEntitlement }) {
  const look =
    m.access === 'NONE'      ? { label: 'Not subscribed', bg: '#f1f5f9', fg: '#64748b' }
    : m.access === 'READ_ONLY' ? { label: m.status === 'CANCELLED' ? 'Cancelled — read only' : 'Lapsed — read only', bg: '#fef2f2', fg: '#b91c1c' }
    : m.status === 'TRIAL'     ? { label: 'On trial',  bg: '#eff6ff', fg: '#1d4ed8' }
    : { label: 'Active', bg: '#f0fdf4', fg: '#15803d' };

  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      background: look.bg, color: look.fg, whiteSpace: 'nowrap',
    }}>
      {look.label}
    </span>
  );
}

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 14,
};
const btn: CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', minHeight: 36,
};
const inp: CSSProperties = {
  padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 13.5, width: '100%',
};

// ── Grant / renew form ────────────────────────────────────────────────────────

function GrantForm({ associationId, module, current, onDone }: {
  associationId: string; module: ModuleKey;
  current: ModuleEntitlement; onDone: () => void;
}) {
  const [grant, { isLoading }] = useGrantModuleMutation();
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

  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
      {error && (
        <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 130px' }}>
          <label style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 3 }}>Type</label>
          <select style={inp} value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)}>
            <option value="ACTIVE">Paid</option>
            <option value="TRIAL">Trial</option>
          </select>
        </div>

        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 3 }}>Starts</label>
          <input style={inp} type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} />
        </div>

        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 3 }}>Expires</label>
          <input style={{ ...inp, opacity: perpetual ? 0.4 : 1 }} type="date" value={expiresOn}
                 disabled={perpetual} onChange={e => setExpiresOn(e.target.value)} />
        </div>

        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 3 }}>Amount (₹)</label>
          <input style={inp} inputMode="decimal" value={amount}
                 onChange={e => setAmount(e.target.value)} placeholder="Optional" />
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <label style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 3 }}>Reference</label>
          <input style={inp} value={reference} onChange={e => setReference(e.target.value)}
                 placeholder="Invoice no." />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#475569' }}>
        <input type="checkbox" checked={perpetual} onChange={e => setPerpetual(e.target.checked)} />
        Perpetual — never expires
      </label>
      {perpetual && (
        <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
          This association will never be asked to renew. Intended for your own
          reference and demo associations.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={isLoading}
          style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
          {isLoading ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onDone}
          style={{ ...btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { data, isLoading } = useListSubscriptionsQuery();
  const [cancelModule] = useCancelModuleMutation();
  const [editing, setEditing] = useState<string | null>(null);   // `${assocId}:${module}`

  const associations = data?.data ?? [];

  const stop = async (associationId: string, module: ModuleKey, name: string) => {
    if (!window.confirm(
      `Stop ${module} for ${name}?\n\n` +
      `They keep access to existing records but cannot make new entries or ` +
      `generate reports until it is renewed.`
    )) return;
    await cancelModule({ associationId, module });
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Administration' }, { label: 'Subscriptions' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 1000 }}>
        <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 18, maxWidth: 720 }}>
          New associations start on a {data?.trial_days ?? 90}-day trial of every module.
          When a subscription ends they keep seeing their records but cannot make
          entries or produce reports. Nothing is ever deleted.
        </p>

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : associations.map(a => (
          <div key={a.id} style={card}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{a.name}</div>
              {a.city && <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{a.city}</div>}
            </div>

            {a.modules.map(m => {
              const key = `${a.id}:${m.module}`;
              return (
                <div key={m.module}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '11px 16px', borderBottom: '1px solid #f8fafc',
                  }}>
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                        {m.expires_on === null && m.status
                          ? 'Perpetual'
                          : m.expires_on
                            ? `Until ${fmtDate(m.expires_on)}${
                                m.days_left !== null && m.days_left >= 0 ? ` · ${m.days_left} days left` : ''}`
                            : 'Never granted'}
                      </div>
                    </div>

                    <AccessPill m={m} />

                    <div style={{ display: 'flex', gap: 7 }}>
                      <button onClick={() => setEditing(editing === key ? null : key)}
                        style={{ ...btn, background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        {m.access === 'FULL' ? 'Change' : 'Grant'}
                      </button>
                      {m.access !== 'NONE' && m.status !== 'CANCELLED' && (
                        <button onClick={() => stop(a.id, m.module, a.name)}
                          style={{ ...btn, background: '#fff', color: '#dc2626', border: '1px solid #fecaca' }}>
                          Stop
                        </button>
                      )}
                    </div>
                  </div>

                  {editing === key && (
                    <GrantForm
                      associationId={a.id}
                      module={m.module}
                      current={m}
                      onDone={() => setEditing(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Layout>
  );
}
