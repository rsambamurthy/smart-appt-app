import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListAccountsQuery, useSeedAccountsMutation,
  useCreateAccountMutation, useUpdateAccountMutation,
  useToggleAccountMutation, useDeleteAccountMutation,
  Account, AccountType,
} from '../../store/api/accountingApi';

// ── Type config ──────────────────────────────────────────────────────────────
const TYPE_META: Record<AccountType, { label: string; icon: string; color: string; bg: string }> = {
  ASSET:     { label: 'Assets',      icon: 'ti-building-bank',   color: '#2563eb', bg: '#eff6ff' },
  LIABILITY: { label: 'Liabilities', icon: 'ti-arrow-down-circle', color: '#dc2626', bg: '#fef2f2' },
  INCOME:    { label: 'Income',      icon: 'ti-trending-up',     color: '#16a34a', bg: '#f0fdf4' },
  EXPENSE:   { label: 'Expenses',    icon: 'ti-trending-down',   color: '#d97706', bg: '#fffbeb' },
  EQUITY:    { label: 'Equity',      icon: 'ti-scale',           color: '#7c3aed', bg: '#f5f3ff' },
};

const TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];

interface AccountForm { code: string; name: string; type: AccountType; sub_type: string; description: string }
const emptyForm = (): AccountForm => ({ code: '', name: '', type: 'ASSET', sub_type: '', description: '' });

// ── Shared styles ────────────────────────────────────────────────────────────
const fl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 };
const fc: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' };

export default function ChartOfAccountsPage() {
  const { data, isLoading } = useListAccountsQuery();
  const [seedAccounts, { isLoading: isSeeding }] = useSeedAccountsMutation();
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();
  const [updateAccount] = useUpdateAccountMutation();
  const [toggleAccount] = useToggleAccountMutation();
  const [deleteAccount] = useDeleteAccountMutation();

  const accounts = data?.data ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AccountForm>(emptyForm());
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AccountForm>>({});
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    try { await seedAccounts().unwrap(); } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    setAddError('');
    if (!addForm.code.trim()) { setAddError('Account code is required.'); return; }
    if (!addForm.name.trim()) { setAddError('Account name is required.'); return; }
    try {
      await createAccount({ ...addForm, sub_type: addForm.sub_type || null, description: addForm.description || null }).unwrap();
      setAddForm(emptyForm()); setShowAdd(false);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setAddError(err?.data?.message ?? 'Failed to create account.');
    }
  };

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setEditForm({ code: a.code, name: a.name, type: a.type, sub_type: a.sub_type ?? '', description: a.description ?? '' });
    setEditError('');
  };

  const handleSaveEdit = async (a: Account) => {
    setEditError('');
    if (!editForm.name?.trim()) { setEditError('Name is required.'); return; }
    try {
      await updateAccount({ id: a.id, body: { ...editForm, sub_type: editForm.sub_type || null, description: editForm.description || null } }).unwrap();
      setEditingId(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setEditError(err?.data?.message ?? 'Failed to update.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteAccount(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setDeleteError(err?.data?.message ?? 'Cannot delete this account.');
    }
  };

  // ── Group accounts by type ────────────────────────────────────────────────
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.type === type);
    return acc;
  }, {} as Record<AccountType, Account[]>);

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'Accounting' }, { label: 'Chart of Accounts' }]}
      />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 900 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 13, color: '#64748b' }}>
            {accounts.length} accounts · {accounts.filter(a => a.is_active).length} active
          </div>
          {accounts.length === 0 && (
            <button onClick={handleSeed} disabled={isSeeding} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 7, border: '1px solid #e2e8f0',
              background: '#fff', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              <i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true" />
              {isSeeding ? 'Seeding…' : 'Load standard accounts'}
            </button>
          )}
          <button onClick={() => { setShowAdd(true); setAddError(''); setAddForm(emptyForm()); }} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7, border: 'none',
            background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            <i className="ti ti-plus" style={{ fontSize: 15 }} aria-hidden="true" />
            Add Account
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>New Account</div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 1fr', gap: '0 12px', marginBottom: 10 }}>
              <div><label style={fl}>Code</label><input style={fc} value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 1006" /></div>
              <div><label style={fl}>Name</label><input style={fc} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Account name" /></div>
              <div>
                <label style={fl}>Type</label>
                <select style={fc} value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value as AccountType }))}>
                  {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                </select>
              </div>
              <div><label style={fl}>Sub-type</label><input style={fc} value={addForm.sub_type} onChange={e => setAddForm(f => ({ ...f, sub_type: e.target.value }))} placeholder="e.g. Current Asset" /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={fl}>Description (optional)</label>
              <input style={fc} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
            </div>
            {addError && <div style={{ marginBottom: 10, fontSize: 12.5, color: '#dc2626' }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAdd} disabled={isCreating} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {isCreating ? 'Adding…' : 'Add Account'}
              </button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : (
          TYPE_ORDER.map(type => {
            const list = grouped[type];
            const meta = TYPE_META[type];
            return (
              <div key={type} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: meta.bg, borderBottom: '1px solid #e2e8f0' }}>
                  <i className={`ti ${meta.icon}`} style={{ fontSize: 16, color: meta.color }} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: meta.color, fontWeight: 500 }}>{list.length} account{list.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Account rows */}
                {list.length === 0 ? (
                  <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8' }}>No {meta.label.toLowerCase()} accounts yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', width: 80 }}>Code</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', width: 160 }}>Sub-type</th>
                        <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', width: 80 }}>Status</th>
                        <th style={{ padding: '7px 14px', width: 110 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((a, idx) => {
                        const isEditing = editingId === a.id;
                        return (
                          <tr key={a.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', opacity: a.is_active ? 1 : 0.5 }}>
                            {isEditing ? (
                              <td colSpan={5} style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 160px', gap: '0 10px', marginBottom: 8 }}>
                                  <div><label style={fl}>Code</label><input style={{ ...fc, background: a.is_system ? '#f8fafc' : '#fff' }} value={editForm.code ?? ''} readOnly={a.is_system} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} /></div>
                                  <div><label style={fl}>Name</label><input style={fc} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                                  <div><label style={fl}>Sub-type</label><input style={{ ...fc, background: a.is_system ? '#f8fafc' : '#fff' }} value={editForm.sub_type ?? ''} readOnly={a.is_system} onChange={e => setEditForm(f => ({ ...f, sub_type: e.target.value }))} /></div>
                                </div>
                                {editError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{editError}</div>}
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => handleSaveEdit(a)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12.5, cursor: 'pointer' }}>Save</button>
                                  <button onClick={() => setEditingId(null)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
                                </div>
                              </td>
                            ) : (
                              <>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#475569', fontSize: 12.5 }}>{a.code}</td>
                                <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 500 }}>
                                  {a.name}
                                  {a.is_system && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '1px 6px', borderRadius: 4 }}>SYSTEM</span>}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12.5 }}>{a.sub_type ?? '—'}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: a.is_active ? '#dcfce7' : '#f1f5f9', color: a.is_active ? '#15803d' : '#64748b' }}>
                                    {a.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button className="ent-ia ent-ia-edit" title="Edit" onClick={() => startEdit(a)}>✎</button>
                                    {!a.is_system && (
                                      <>
                                        {a.is_active
                                          ? <button className="ent-ia ent-ia-del" title="Deactivate" onClick={() => toggleAccount(a.id)}>⊗</button>
                                          : <button className="ent-ia ent-ia-edit" title="Activate" onClick={() => toggleAccount(a.id)}>↺</button>
                                        }
                                        <button className="ent-ia ent-ia-del" title="Delete" onClick={() => { setDeleteTarget(a); setDeleteError(''); }}>🗑</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete Account?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              <strong>{deleteTarget.code} — {deleteTarget.name}</strong><br />
              This cannot be undone. Accounts linked to journal entries cannot be deleted.
            </div>
            {deleteError && <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 12 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDelete} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => { setDeleteTarget(null); setDeleteError(''); }} style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
