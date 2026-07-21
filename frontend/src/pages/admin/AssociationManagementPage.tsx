import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListAssociationsQuery,
  useUpdateAssociationMutation,
  useDeleteAssociationMutation,
  useHardDeleteAssociationMutation,
} from '../../store/api/associationsApi';

interface Association {
  id: string; name: string; address?: string; city?: string; state?: string;
  pincode?: string; is_active: boolean; created_at: string;
  _count: { users: number; units: number };
}

interface EditForm { name: string; address: string; city: string; state: string; pincode: string; }

type FilterTab = 'all' | 'active' | 'inactive';

export default function AssociationManagementPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useListAssociationsQuery();
  const associations = (data?.data ?? []) as Association[];

  const [updateAssociation] = useUpdateAssociationMutation();
  const [deleteAssociation] = useDeleteAssociationMutation();
  const [hardDeleteAssociation] = useHardDeleteAssociationMutation();

  const [filter, setFilter] = useState<FilterTab>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', address: '', city: '', state: '', pincode: '' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<Association | null>(null);
  const [deactivateError, setDeactivateError] = useState('');

  const [reactivateTarget, setReactivateTarget] = useState<Association | null>(null);
  const [reactivateError, setReactivateError] = useState('');
  const [reactivating, setReactivating] = useState(false);

  const [hardDeleteTarget, setHardDeleteTarget] = useState<Association | null>(null);
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');
  const [hardDeleteError, setHardDeleteError] = useState('');
  const [hardDeleting, setHardDeleting] = useState(false);

  const filtered = associations.filter((a) =>
    filter === 'all' ? true : filter === 'active' ? a.is_active : !a.is_active
  );

  const startEdit = (a: Association) => {
    setEditingId(a.id);
    setEditForm({ name: a.name, address: a.address ?? '', city: a.city ?? '', state: a.state ?? '', pincode: a.pincode ?? '' });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    setSaving(true);
    try {
      await updateAssociation({ id: editingId, body: editForm }).unwrap();
      setEditingId(null);
    } catch (e: unknown) {
      setEditError((e as { data?: { title?: string; detail?: string; message?: string } })?.data?.title ?? 'Update failed.');
    } finally { setSaving(false); }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivateError('');
    try {
      await deleteAssociation(deactivateTarget.id).unwrap();
      setDeactivateTarget(null);
    } catch (e: unknown) {
      setDeactivateError((e as { data?: { title?: string; detail?: string; message?: string } })?.data?.title ?? 'Failed to deactivate.');
    }
  };

  const confirmReactivate = async () => {
    if (!reactivateTarget) return;
    setReactivateError('');
    setReactivating(true);
    try {
      await updateAssociation({ id: reactivateTarget.id, body: { is_active: true } }).unwrap();
      setReactivateTarget(null);
    } catch (e: unknown) {
      setReactivateError((e as { data?: { title?: string; detail?: string; message?: string } })?.data?.title ?? 'Failed to reactivate.');
    } finally { setReactivating(false); }
  };

  const confirmHardDelete = async () => {
    if (!hardDeleteTarget) return;
    if (hardDeleteConfirmText !== hardDeleteTarget.name) {
      setHardDeleteError('Association name does not match. Type the exact name to confirm.');
      return;
    }
    setHardDeleteError('');
    setHardDeleting(true);
    try {
      await hardDeleteAssociation(hardDeleteTarget.id).unwrap();
      setHardDeleteTarget(null);
      setHardDeleteConfirmText('');
    } catch (e: unknown) {
      setHardDeleteError((e as { data?: { title?: string } })?.data?.title ?? 'Failed to delete association.');
    } finally { setHardDeleting(false); }
  };

  const set = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const tabStyle = (t: FilterTab) => ({
    padding: '5px 16px', fontSize: '0.82rem', fontWeight: 600, borderRadius: 6,
    border: '1px solid var(--color-border)', cursor: 'pointer',
    background: filter === t ? 'var(--color-primary)' : '#f9fafb',
    color: filter === t ? '#fff' : 'var(--color-muted)',
  } as React.CSSProperties);

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Associations' }]} />
      <div style={{ padding: '1.5rem 2rem' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total', value: associations.length, color: '#1e3a5f' },
            { label: 'Active', value: associations.filter((a) => a.is_active).length, color: '#16a34a' },
            { label: 'Inactive', value: associations.filter((a) => !a.is_active).length, color: '#dc2626' },
          ].map((s) => (
            <div key={s.label} className="ent-section" style={{ flex: 1, padding: '1rem 1.25rem', margin: 0 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="ent-section">
          <div className="ent-section-hdr" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <span className="ent-section-title">All Associations</span>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button style={tabStyle('all')} onClick={() => setFilter('all')}>All ({associations.length})</button>
              <button style={tabStyle('active')} onClick={() => setFilter('active')}>Active ({associations.filter(a => a.is_active).length})</button>
              <button style={tabStyle('inactive')} onClick={() => setFilter('inactive')}>Inactive ({associations.filter(a => !a.is_active).length})</button>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
          ) : (
            <div className="ent-page-table">
              <table>
                <thead>
                  <tr>
                    <th>Association</th>
                    <th>Location</th>
                    <th style={{ textAlign: 'center' }}>Users</th>
                    <th style={{ textAlign: 'center' }}>Units</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    editingId === a.id ? (
                      <tr key={a.id} style={{ background: '#f8fafc' }}>
                        <td colSpan={7} style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <div style={{ flex: '2 1 200px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: 3 }}>Name *</label>
                              <input className="ent-fc" value={editForm.name} onChange={set('name')} />
                            </div>
                            <div style={{ flex: '3 1 250px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: 3 }}>Address</label>
                              <input className="ent-fc" value={editForm.address} onChange={set('address')} />
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: 3 }}>City</label>
                              <input className="ent-fc" value={editForm.city} onChange={set('city')} />
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: 3 }}>State</label>
                              <input className="ent-fc" value={editForm.state} onChange={set('state')} />
                            </div>
                            <div style={{ flex: '0 0 100px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: 3 }}>Pincode</label>
                              <input className="ent-fc" value={editForm.pincode} onChange={set('pincode')} maxLength={10} />
                            </div>
                          </div>
                          {editError && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.5rem' }}>{editError}</div>}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button className="ent-btn-submit" style={{ padding: '4px 14px', fontSize: '0.8rem' }} onClick={saveEdit} disabled={saving}>Save</button>
                            <button className="ent-btn-cancel" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={a.id} style={{ opacity: a.is_active ? 1 : 0.7 }}>
                        <td data-label="Association">
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.name}</div>
                        </td>
                        <td data-label="Location" style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                          {[a.city, a.state, a.pincode].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td data-label="Users" style={{ textAlign: 'center', fontWeight: 600 }}>{a._count.users}</td>
                        <td data-label="Units" style={{ textAlign: 'center', fontWeight: 600 }}>{a._count.units}</td>
                        <td data-label="Registered" style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td data-label="Status">
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                            background: a.is_active ? '#f0fdf4' : '#fef2f2',
                            color: a.is_active ? '#16a34a' : '#dc2626',
                          }}>
                            {a.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td data-label="Actions" style={{ textAlign: 'right' }}>
                          {a.is_active ? (
                            <>
                              <button
                                title="View units & occupants"
                                onClick={() => navigate(`/admin/associations/${a.id}`)}
                                style={{ marginRight: 4, padding: '3px 9px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--color-border)', background: '#f8fafc', color: 'var(--color-primary)', fontWeight: 600 }}
                              >
                                👁 View
                              </button>
                              <button className="ent-ia ent-ia-edit" title="Edit" onClick={() => startEdit(a)}>✎</button>
                              <button
                                title="Deactivate"
                                onClick={() => { setDeactivateTarget(a); setDeactivateError(''); }}
                                style={{ marginLeft: 4, padding: '3px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}
                              >
                                Deactivate
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                title="Reactivate this association"
                                onClick={() => { setReactivateTarget(a); setReactivateError(''); }}
                                style={{ marginRight: 4, padding: '3px 10px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}
                              >
                                ↺ Reactivate
                              </button>
                              {a._count.units === 0 ? (
                                <button
                                  title="Permanently delete — cannot be undone"
                                  onClick={() => { setHardDeleteTarget(a); setHardDeleteConfirmText(''); setHardDeleteError(''); }}
                                  style={{ padding: '3px 9px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid #991b1b', background: '#7f1d1d', color: '#fff', fontWeight: 600 }}
                                >
                                  🗑 Delete
                                </button>
                              ) : (
                                <span title={`Cannot delete: ${a._count.units} unit(s) still exist`} style={{ padding: '3px 9px', fontSize: '0.75rem', borderRadius: 4, border: '1px solid #d1d5db', background: '#f3f4f6', color: '#9ca3af', fontWeight: 600, cursor: 'not-allowed' }}>
                                  🗑 Delete
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                      {filter === 'inactive' ? 'No inactive associations.' : filter === 'active' ? 'No active associations.' : 'No associations yet.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Deactivate confirm modal */}
      {deactivateTarget && (
        <>
          <div onClick={() => setDeactivateTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>Deactivate Association?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              <strong>{deactivateTarget.name}</strong> will be deactivated. All users in this association will lose access. You can reactivate it at any time.
            </div>
            {deactivateError && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{deactivateError}</div>}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={confirmDeactivate}>Deactivate</button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => { setDeactivateTarget(null); setDeactivateError(''); }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Hard Delete confirm modal */}
      {hardDeleteTarget && (
        <>
          <div onClick={() => !hardDeleting && setHardDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 201 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem' }}>⚠️</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#7f1d1d' }}>Permanently Delete Association?</div>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem', lineHeight: 1.6 }}>
              This will <strong>permanently and irreversibly delete</strong> <strong style={{ color: '#7f1d1d' }}>{hardDeleteTarget.name}</strong> and ALL associated data including:
            </div>
            <ul style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.75rem 1.25rem', lineHeight: 1.8 }}>
              <li>All users, units, and residents</li>
              <li>All bills, payments, and dues history</li>
              <li>All maintenance tickets and expenses</li>
              <li>All announcements, documents, and polls</li>
            </ul>
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#991b1b', fontWeight: 600 }}>
              ⛔ This action CANNOT be undone.
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                Type <strong>{hardDeleteTarget.name}</strong> to confirm:
              </label>
              <input
                className="ent-fc"
                value={hardDeleteConfirmText}
                onChange={(e) => setHardDeleteConfirmText(e.target.value)}
                placeholder="Type association name exactly"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            {hardDeleteError && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{hardDeleteError}</div>}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                onClick={confirmHardDelete}
                disabled={hardDeleting || hardDeleteConfirmText !== hardDeleteTarget.name}
                style={{
                  flex: 1, padding: '8px', fontSize: '0.85rem', fontWeight: 700, borderRadius: 6, border: 'none', cursor: hardDeleteConfirmText === hardDeleteTarget.name ? 'pointer' : 'not-allowed',
                  background: hardDeleteConfirmText === hardDeleteTarget.name ? '#7f1d1d' : '#d1d5db', color: '#fff',
                }}
              >
                {hardDeleting ? 'Deleting…' : '🗑 Permanently Delete'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => { setHardDeleteTarget(null); setHardDeleteConfirmText(''); setHardDeleteError(''); }} disabled={hardDeleting}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Reactivate confirm modal */}
      {reactivateTarget && (
        <>
          <div onClick={() => setReactivateTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#16a34a' }}>↺ Reactivate Association?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              <strong>{reactivateTarget.name}</strong> will be reactivated. All its users will regain access to the system immediately.
            </div>
            {reactivateError && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{reactivateError}</div>}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                className="ent-btn-submit"
                style={{ background: '#16a34a', flex: 1 }}
                onClick={confirmReactivate}
                disabled={reactivating}
              >
                {reactivating ? 'Reactivating…' : 'Yes, Reactivate'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => { setReactivateTarget(null); setReactivateError(''); }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
