import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetAssociationQuery } from '../../store/api/associationsApi';
import { useListUnitsQuery, useListUsersQuery, useCreateUnitMutation, useUpdateUnitMutation, useDeleteUnitMutation } from '../../store/api/usersApi';

interface Association {
  id: string; name: string; address: string; city: string; state: string;
  pincode: string; contact_name: string; contact_email: string; contact_phone: string;
  plan: string; is_active: boolean; created_at: string;
}

interface UnitUser { id: string; name: string; phone: string; role: string; is_owner: boolean; }

interface Unit {
  id: string; flat_number: string; block?: string; floor?: number;
  area_sqft?: number; unit_type?: string; users: UnitUser[];
}

interface UnitForm {
  flat_number: string; block: string; floor: string; area_sqft: string; unit_type: string;
}

const emptyForm = (): UnitForm => ({ flat_number: '', block: '', floor: '', area_sqft: '', unit_type: '' });

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  RESIDENT:  { bg: '#eff6ff', color: '#1d4ed8' },
  MANAGER:   { bg: '#f0fdf4', color: '#15803d' },
  TREASURER: { bg: '#fdf4ff', color: '#7e22ce' },
  COMMITTEE: { bg: '#fff7ed', color: '#c2410c' },
};

const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem' };
const lbl: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: 3 };

export default function AssociationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'units' | 'users'>('units');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Unit form state
  const [showForm, setShowForm] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitForm>(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: assocData, isLoading: assocLoading } = useGetAssociationQuery(id!);
  const { data: unitsData, isLoading: unitsLoading } = useListUnitsQuery({ association_id: id });
  const { data: usersData, isLoading: usersLoading } = useListUsersQuery({ association_id: id, limit: 200 });
  const [createUnit] = useCreateUnitMutation();
  const [updateUnit] = useUpdateUnitMutation();
  const [deleteUnit] = useDeleteUnitMutation();

  interface AllUser { id: string; name: string; phone: string; role: string; email?: string; unit_id?: string; is_active: boolean; unit?: { flat_number: string; block?: string } }
  const assoc = assocData?.data as Association | undefined;
  const allUnits = (unitsData?.data ?? []) as Unit[];
  const allUsers = ((usersData as { data?: unknown[] })?.data ?? []) as AllUser[];

  const units = allUnits.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.flat_number.toLowerCase().includes(s) ||
      (u.block ?? '').toLowerCase().includes(s) ||
      u.users.some((usr) => usr.name.toLowerCase().includes(s) || usr.phone.includes(s));
  });

  const toggleUnit = (uid: string) => setExpandedUnits((p) => { const n = new Set(p); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  const setF = (k: keyof UnitForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setEditingUnitId(null); setForm(emptyForm()); setFormError(''); setShowForm(true); };
  const openEdit = (u: Unit) => {
    setEditingUnitId(u.id);
    setForm({ flat_number: u.flat_number, block: u.block ?? '', floor: u.floor?.toString() ?? '', area_sqft: u.area_sqft?.toString() ?? '', unit_type: u.unit_type ?? '' });
    setFormError(''); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.flat_number.trim()) { setFormError('Flat number is required.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        flat_number: form.flat_number.trim(),
        block: form.block.trim() || undefined,
        floor: form.floor ? parseInt(form.floor) : undefined,
        area_sqft: form.area_sqft ? parseFloat(form.area_sqft) : undefined,
        unit_type: form.unit_type || undefined,
        association_id: id,
      };
      if (editingUnitId) {
        await updateUnit({ id: editingUnitId, body: payload, association_id: id }).unwrap();
      } else {
        await createUnit(payload).unwrap();
      }
      setShowForm(false);
    } catch (e: unknown) {
      const err = e as { data?: { title?: string; detail?: string } };
      setFormError(err?.data?.detail ?? err?.data?.title ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await deleteUnit({ id: deleteTarget.id, association_id: id }).unwrap(); setDeleteTarget(null); }
    catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const occupiedUnits = allUnits.filter((u) => u.users.length > 0).length;
  const totalUsers = allUnits.reduce((s, u) => s + u.users.length, 0);

  if (assocLoading) return <Layout><div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div></Layout>;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Associations', path: '/admin/associations' }, { label: assoc?.name ?? '…' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* Association header */}
        {assoc && (
          <div className="ent-section" style={{ marginBottom: '1.25rem' }}>
            <div className="ent-section-hdr">
              <div>
                <span className="ent-section-title">{assoc.name}</span>
                <span style={{ marginLeft: 10, fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: assoc.is_active ? '#f0fdf4' : '#fef2f2', color: assoc.is_active ? '#16a34a' : '#dc2626' }}>
                  {assoc.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button onClick={() => navigate('/admin/associations')} style={{ fontSize: '0.8rem', color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', padding: '0 1rem 0.75rem' }}>
              <div><div style={lbl}>ADDRESS</div><div style={{ fontSize: '0.875rem' }}>{assoc.address}, {assoc.city}</div><div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{assoc.state} — {assoc.pincode}</div></div>
              <div><div style={lbl}>CONTACT</div><div style={{ fontSize: '0.875rem' }}>{assoc.contact_name}</div><div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{assoc.contact_phone}</div></div>
              <div><div style={lbl}>PLAN</div><div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{assoc.plan}</div></div>
              <div><div style={lbl}>REGISTERED</div><div style={{ fontSize: '0.875rem' }}>{new Date(assoc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div></div>
            </div>
            {/* Stats */}
            <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem 0.75rem', borderTop: '1px solid var(--color-border)' }}>
              {[
                { label: 'Total Units',      value: allUnits.length,                   color: '#1e3a5f' },
                { label: 'Occupied',         value: occupiedUnits,                     color: '#16a34a' },
                { label: 'Vacant',           value: allUnits.length - occupiedUnits,   color: '#f59e0b' },
                { label: 'Residents/Staff',  value: totalUsers,                        color: '#7c3aed' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="ent-section">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 1rem', gap: '0.25rem' }}>
            {([['units', `Units (${allUnits.length})`], ['users', `All Users (${allUsers.length})`]] as const).map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setSearch(''); }}
                style={{ padding: '0.6rem 1rem', fontWeight: tab === t ? 700 : 400, fontSize: '0.85rem', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent', color: tab === t ? 'var(--color-primary)' : 'var(--color-muted)', cursor: 'pointer', marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'units' && (<>
          <div className="ent-section-hdr" style={{ borderTop: 'none' }}>
            <span className="ent-section-title" style={{ fontSize: '0.9rem' }}>Units & Occupants</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.8rem', width: 180 }} />
              <button onClick={() => setExpandedUnits(new Set(units.map((u) => u.id)))} style={{ fontSize: '0.78rem', padding: '4px 9px', borderRadius: 5, border: '1px solid var(--color-border)', background: '#f9fafb', cursor: 'pointer' }}>Expand All</button>
              <button onClick={() => setExpandedUnits(new Set())} style={{ fontSize: '0.78rem', padding: '4px 9px', borderRadius: 5, border: '1px solid var(--color-border)', background: '#f9fafb', cursor: 'pointer' }}>Collapse All</button>
              <button className="ent-btn-submit" style={{ padding: '5px 14px', fontSize: '0.82rem' }} onClick={openCreate}>+ Add Unit</button>
            </div>
          </div>

          {unitsLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
          ) : (
            <div style={{ padding: '0 1rem 1rem' }}>
              {units.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                  {search ? 'No units match your search.' : 'No units yet. Click "+ Add Unit" to create the first one.'}
                </div>
              )}
              {units.map((unit) => {
                const isOpen = expandedUnits.has(unit.id);
                return (
                  <div key={unit.id} style={{ marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', background: isOpen ? '#f8fafc' : '#fff' }}
                    >
                      {/* Expand toggle */}
                      <span onClick={() => toggleUnit(unit.id)} style={{ fontSize: '0.7rem', color: 'var(--color-muted)', cursor: 'pointer', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s', userSelect: 'none' }}>▶</span>

                      {/* Unit badge */}
                      <div onClick={() => toggleUnit(unit.id)} style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: unit.users.length > 0 ? 'var(--color-primary)' : '#e5e7eb', color: unit.users.length > 0 ? '#fff' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                        {unit.flat_number}
                      </div>

                      <div onClick={() => toggleUnit(unit.id)} style={{ flex: 1, cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {unit.block ? `Block ${unit.block} — ` : ''}{unit.flat_number}
                          {unit.unit_type && <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginLeft: 6 }}>({unit.unit_type})</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                          {[unit.floor != null && `Floor ${unit.floor}`, unit.area_sqft && `${unit.area_sqft} sq ft`].filter(Boolean).join(' · ')}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {unit.users.length > 0
                          ? <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f0fdf4', color: '#16a34a' }}>{unit.users.length} occupant{unit.users.length !== 1 ? 's' : ''}</span>
                          : <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f9fafb', color: '#9ca3af' }}>Vacant</span>
                        }
                        <button className="ent-ia ent-ia-edit" title="Edit unit" onClick={() => openEdit(unit)}>✎</button>
                        <button className="ent-ia ent-ia-del" title="Delete unit" onClick={() => setDeleteTarget(unit)}>🗑</button>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ borderTop: '1px solid var(--color-border)', background: '#f8fafc', padding: '0.5rem 1rem 0.625rem 4.5rem' }}>
                        {unit.users.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '0.4rem 0' }}>No occupants assigned.</div>
                        ) : unit.users.map((usr) => {
                          const rc = ROLE_COLOR[usr.role] ?? { bg: '#f1f5f9', color: '#64748b' };
                          return (
                            <div key={usr.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>
                                {usr.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                  {usr.name}
                                  {usr.is_owner && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>Owner</span>}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{usr.phone}</div>
                              </div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: rc.bg, color: rc.color }}>{usr.role}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </>)}

          {tab === 'users' && (
            <div style={{ padding: '1rem' }}>
              <input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.8rem', width: 220, marginBottom: '0.75rem' }} />
              {usersLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Name', 'Phone', 'Role', 'Unit', 'Status'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers
                      .filter((u) => {
                        if (!search) return true;
                        const s = search.toLowerCase();
                        return u.name.toLowerCase().includes(s) || u.phone.includes(s);
                      })
                      .map((u) => {
                        const rc = ROLE_COLOR[u.role] ?? { bg: '#f1f5f9', color: '#64748b' };
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '10px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
                                  {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 600 }}>{u.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px', color: 'var(--color-muted)' }}>{u.phone}</td>
                            <td style={{ padding: '10px 10px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: rc.bg, color: rc.color }}>{u.role}</span>
                            </td>
                            <td style={{ padding: '10px 10px', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                              {u.unit ? `${u.unit.block ? `Block ${u.unit.block} — ` : ''}${u.unit.flat_number}` : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 10px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: u.is_active ? '#f0fdf4' : '#fef2f2', color: u.is_active ? '#16a34a' : '#dc2626' }}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    {allUsers.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No users in this association.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Unit Modal ─────────────────────────────────────────── */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.75rem', width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>{editingUnitId ? 'Edit Unit' : 'Add Unit'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={lbl}>Flat / Unit Number *</label>
                <input style={inp} placeholder="e.g. A101" value={form.flat_number} onChange={setF('flat_number')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={lbl}>Block</label><input style={inp} placeholder="e.g. A" value={form.block} onChange={setF('block')} /></div>
                <div><label style={lbl}>Floor</label><input style={inp} type="number" placeholder="e.g. 1" value={form.floor} onChange={setF('floor')} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={lbl}>Area (sq ft)</label><input style={inp} type="number" placeholder="e.g. 1200" value={form.area_sqft} onChange={setF('area_sqft')} /></div>
                <div>
                  <label style={lbl}>Unit Type</label>
                  <select style={inp} value={form.unit_type} onChange={setF('unit_type')}>
                    <option value="">— select —</option>
                    <option value="1BHK">1 BHK</option>
                    <option value="2BHK">2 BHK</option>
                    <option value="3BHK">3 BHK</option>
                    <option value="4BHK">4 BHK</option>
                    <option value="STUDIO">Studio</option>
                    <option value="PENTHOUSE">Penthouse</option>
                    <option value="COMMERCIAL">Commercial</option>
                  </select>
                </div>
              </div>
            </div>
            {formError && <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem' }}>{formError}</div>}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="ent-btn-submit" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editingUnitId ? 'Save Changes' : 'Add Unit'}</button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Delete Unit?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1.25rem' }}>
              Unit <strong>{deleteTarget.flat_number}</strong> will be permanently deleted.
              {deleteTarget.users.length > 0 && <span style={{ color: '#dc2626' }}> {deleteTarget.users.length} occupant(s) will be unlinked.</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
