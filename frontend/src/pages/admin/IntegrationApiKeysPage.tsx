import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListApiKeysQuery, useCreateApiKeyMutation, useRevokeApiKeyMutation,
  API_KEY_SCOPES, CreatedIntegrationApiKey,
} from '../../store/api/integrationsApi';

/**
 * Scoped credentials an outside service (the BPM/workflow tool) uses to call
 * specific SmartAppt actions directly — approve an expense, waive a penalty,
 * update a ticket's status — without a shared human login. A key only ever
 * grants the exact scopes it was created with; the backend enforces that
 * independently (middleware/api-key-scope.ts), so this screen is purely
 * about creating and revoking, never about what a key can technically do
 * once minted.
 */

const labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 } as const;
const inputStyle = { width: '100%', maxWidth: 420, padding: '8px 11px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, boxSizing: 'border-box' } as const;

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function IntegrationApiKeysPage() {
  const { data, isLoading } = useListApiKeysQuery();
  const [createKey, { isLoading: isCreating }] = useCreateApiKeyMutation();
  const [revokeKey] = useRevokeApiKeyMutation();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [justCreated, setJustCreated] = useState<CreatedIntegrationApiKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const keys = data?.data ?? [];

  const toggleScope = (v: string) =>
    setScopes((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const handleCreate = async () => {
    setError('');
    if (name.trim().length < 3) { setError('Give this key a name — e.g. "Escalation Workflow".'); return; }
    if (scopes.length === 0) { setError('Pick at least one scope.'); return; }
    try {
      const result = await createKey({ name: name.trim(), scopes }).unwrap();
      setJustCreated(result.data);
      setShowForm(false);
      setName(''); setScopes([]);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setError(err?.data?.message ?? 'Could not create the key.');
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'Integration API Keys' }]} />

      <div style={{ padding: '1.5rem 2rem', maxWidth: 860 }}>
        <div style={{ padding: '0.7rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.85rem', color: '#1d4ed8', marginBottom: '1.25rem' }}>
          Generate a scoped key for an outside tool — like the BPM/workflow system — to call specific SmartAppt actions on this association's behalf. A key can only do exactly what its scopes say; it can never log in or browse the app like a user.
        </div>

        {justCreated && (
          <div style={{ padding: '1rem 1.25rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: '#166534', marginBottom: 8 }}>
              "{justCreated.name}" created — copy this secret now
            </div>
            <div style={{ fontSize: 12.5, color: '#166534', marginBottom: 8 }}>
              This is the only time the full secret is shown. If you lose it, revoke this key and create a new one.
            </div>
            <code style={{
              display: 'block', padding: '10px 12px', background: '#052e16', color: '#bbf7d0',
              borderRadius: 6, fontSize: 13, wordBreak: 'break-all', userSelect: 'all',
            }}>
              {justCreated.secret}
            </code>
            <button onClick={() => setJustCreated(null)}
              style={{ marginTop: 10, padding: '6px 14px', borderRadius: 6, border: '1px solid #86efac', background: '#fff', color: '#166534', fontSize: 12.5, cursor: 'pointer' }}>
              Done, I've copied it
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Keys ({keys.length})</h3>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              + New Key
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.25rem', background: '#fff' }}>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Expense Approval Workflow" />

            <div style={{ marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>Scopes</div>
            {API_KEY_SCOPES.map((s) => (
              <label key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', marginBottom: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={scopes.includes(s.value)} onChange={() => toggleScope(s.value)} />
                {s.label}
                <code style={{ fontSize: 11, color: '#94a3b8' }}>{s.value}</code>
              </label>
            ))}

            {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#dc2626' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleCreate} disabled={isCreating}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: isCreating ? 0.7 : 1 }}>
                {isCreating ? 'Creating…' : 'Create Key'}
              </button>
              <button onClick={() => { setShowForm(false); setError(''); }}
                style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>No keys yet.</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {keys.map((k) => {
              const revoked = !k.is_active || !!k.revoked_at;
              return (
                <div key={k.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', opacity: revoked ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b', textDecoration: revoked ? 'line-through' : 'none' }}>
                        {k.name} <code style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{k.key_prefix}…</code>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
                        {k.scopes.join(', ')}
                      </div>
                      <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3 }}>
                        Created {fmt(k.created_at)}{k.creator ? ` by ${k.creator.name}` : ''} · Last used {fmt(k.last_used_at)}
                        {revoked && ` · Revoked ${fmt(k.revoked_at)}${k.revoker ? ` by ${k.revoker.name}` : ''}`}
                      </div>
                    </div>
                    {!revoked && (
                      confirmRevoke === k.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11.5, color: '#991b1b' }}>Revoke this key?</span>
                          <button onClick={() => { revokeKey(k.id); setConfirmRevoke(null); }}
                            style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
                            Yes, revoke
                          </button>
                          <button onClick={() => setConfirmRevoke(null)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11.5, cursor: 'pointer' }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRevoke(k.id)}
                          style={{ padding: '4px 11px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 11.5, cursor: 'pointer', flexShrink: 0 }}>
                          Revoke
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
