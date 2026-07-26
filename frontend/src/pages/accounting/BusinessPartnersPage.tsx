import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { API_BASE } from '../../store/api/baseApi';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListBPMastersQuery, useCreateBPMasterMutation,
  useUpdateBPMasterMutation, useToggleBPMasterMutation,
  useDeleteBPMasterMutation,
  useListUnitsWithBalancesQuery, useApplyUnitOBUploadMutation,
  useListServiceTypesQuery, useCreateServiceTypeMutation,
  useUpdateServiceTypeMutation, useToggleServiceTypeMutation, useDeleteServiceTypeMutation,
  usePreviewVendorUploadMutation, useApplyVendorUploadMutation,
  BusinessPartner, BPCategory, BalanceType, UnitWithBalance, UnitOBPreviewRow, ServiceType, VendorUploadPreviewRow,
} from '../../store/api/accountingApi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BPForm {
  code: string; name: string; email: string; phone: string;
  account_number: string; ifsc: string;
  gstin: string; pan: string; service_type_id: string;
  unit_id: string;
  opening_balance: string; opening_balance_type: BalanceType; opening_balance_date: string;
}
const emptyForm = (): BPForm => ({
  code: '', name: '', email: '', phone: '',
  account_number: '', ifsc: '', gstin: '', pan: '', service_type_id: '', unit_id: '',
  opening_balance: '', opening_balance_type: 'DEBIT', opening_balance_date: '',
});

// ── Shared styles ─────────────────────────────────────────────────────────────
const fl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };
const fc: React.CSSProperties = { width: '100%', padding: '6px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' };
const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7,
  border: primary ? 'none' : danger ? '1px solid #fecaca' : '1px solid #e2e8f0',
  background: primary ? '#2563eb' : danger ? '#fef2f2' : '#fff',
  color: primary ? '#fff' : danger ? '#dc2626' : '#475569',
  fontSize: 12.5, fontWeight: primary ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const,
});
const th: React.CSSProperties = { padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const btnIcon: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8', padding: '2px 5px', borderRadius: 4 };

// ── Accordion shell ───────────────────────────────────────────────────────────
function AccordionSection({
  iconBg, iconColor, icon, title, subtitle, isOpen, onToggle, headerActions, children,
}: {
  iconBg: string; iconColor: string; icon: string;
  title: string; subtitle: string;
  isOpen: boolean; onToggle: () => void;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: '#f8fafc', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
          <i className={`ti ${icon}`} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          {headerActions}
        </div>
        <i
          className="ti ti-chevron-down"
          aria-hidden="true"
          style={{ fontSize: 16, color: '#94a3b8', transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, marginLeft: 4 }}
        />
      </div>
      {isOpen && <div style={{ borderTop: '1px solid #e2e8f0' }}>{children}</div>}
    </div>
  );
}

// ── BP add/edit form ──────────────────────────────────────────────────────────
function BPFormPanel({
  category, form, onChange, onSave, onCancel, isSaving, error, serviceTypes, title,
}: {
  category: BPCategory; form: BPForm; onChange: (f: BPForm) => void;
  onSave: () => void; onCancel: () => void;
  isSaving: boolean; error: string;
  serviceTypes: ServiceType[];
  title: string;
}) {
  const set = (p: Partial<BPForm>) => onChange({ ...form, ...p });
  return (
    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '14px 16px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', gap: '0 10px', marginBottom: 10 }}>
        <div><label style={fl}>Code</label><input style={fc} value={form.code} onChange={e => set({ code: e.target.value })} placeholder="BNK-001" /></div>
        <div><label style={fl}>Name</label><input style={fc} value={form.name} onChange={e => set({ name: e.target.value })} placeholder={category === 'BANK' ? 'HDFC – Current A/c' : 'ABC Electricals'} /></div>
        <div><label style={fl}>Phone</label><input style={fc} value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="9876543210" /></div>
        <div><label style={fl}>Email</label><input style={fc} value={form.email} onChange={e => set({ email: e.target.value })} placeholder="contact@example.com" /></div>
      </div>
      {category === 'BANK' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px', marginBottom: 10 }}>
          <div><label style={fl}>Account number</label><input style={fc} value={form.account_number} onChange={e => set({ account_number: e.target.value })} placeholder="00123456789" /></div>
          <div><label style={fl}>IFSC code</label><input style={fc} value={form.ifsc} onChange={e => set({ ifsc: e.target.value })} placeholder="HDFC0001234" /></div>
        </div>
      )}
      {category === 'VENDOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px', marginBottom: 10 }}>
          <div><label style={fl}>GSTIN</label><input style={fc} value={form.gstin} onChange={e => set({ gstin: e.target.value })} placeholder="29ABCDE1234F1Z5" /></div>
          <div><label style={fl}>PAN</label><input style={fc} value={form.pan} onChange={e => set({ pan: e.target.value })} placeholder="ABCDE1234F" /></div>
          <div>
            <label style={fl}>Service type</label>
            <select style={fc} value={form.service_type_id} onChange={e => set({ service_type_id: e.target.value })}>
              <option value="">— Select —</option>
              {serviceTypes.filter(st => st.is_active).map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 2 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Opening balance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 160px', gap: '0 10px' }}>
          <div>
            <label style={fl}>Amount (₹)</label>
            <input style={fc} type="number" value={form.opening_balance} onChange={e => set({ opening_balance: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label style={fl}>Side</label>
            <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', height: 31 }}>
              {(['DEBIT', 'CREDIT'] as BalanceType[]).map(side => (
                <button key={side} onClick={() => set({ opening_balance_type: side })} style={{ flex: 1, border: 'none', borderRight: side === 'DEBIT' ? '1px solid #e2e8f0' : 'none', background: form.opening_balance_type === side ? '#2563eb' : '#fff', color: form.opening_balance_type === side ? '#fff' : '#475569', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
                  {side === 'DEBIT' ? 'DR' : 'CR'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={fl}>As-on date</label>
            <input style={fc} type="date" value={form.opening_balance_date} onChange={e => set({ opening_balance_date: e.target.value })} />
          </div>
        </div>
      </div>
      {error && <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onSave} disabled={isSaving} style={{ ...btn(true), opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} style={btn()}>Cancel</button>
      </div>
    </div>
  );
}

// ── BP list (inner body — no header) ─────────────────────────────────────────
function BPList({
  category, bps, serviceTypes, showAdd, onHideAdd,
  onCreate, onUpdate, onToggle, onDelete,
}: {
  category: BPCategory;
  bps: BusinessPartner[];
  serviceTypes: ServiceType[];
  showAdd: boolean;
  onHideAdd: () => void;
  onCreate: (body: object) => Promise<void>;
  onUpdate: (id: string, body: object) => Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [addForm, setAddForm]   = useState(emptyForm());
  const [addError, setAddError] = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BusinessPartner | null>(null);

  const label = category === 'BANK' ? 'bank' : 'vendor';

  const buildBody = (f: BPForm) => ({
    code: f.code.trim(), name: f.name.trim(), bp_category: category,
    email: f.email || null, phone: f.phone || null,
    account_number:  category === 'BANK'   ? f.account_number || null : null,
    ifsc:            category === 'BANK'   ? f.ifsc || null : null,
    gstin:           category === 'VENDOR' ? f.gstin || null : null,
    pan:             category === 'VENDOR' ? f.pan || null : null,
    service_type_id: category === 'VENDOR' ? f.service_type_id || null : null,
    opening_balance: f.opening_balance ? parseFloat(f.opening_balance) : null,
    opening_balance_type: f.opening_balance ? f.opening_balance_type : null,
    opening_balance_date: f.opening_balance_date || null,
  });

  const handleAdd = async () => {
    setAddError('');
    if (!addForm.code.trim()) { setAddError('Code is required.'); return; }
    if (!addForm.name.trim()) { setAddError('Name is required.'); return; }
    try {
      await onCreate(buildBody(addForm));
      setAddForm(emptyForm());
      onHideAdd();
    } catch (e: unknown) {
      setAddError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to save.');
    }
  };

  const startEdit = (bp: BusinessPartner) => {
    setEditId(bp.id);
    setEditForm({
      code: bp.code, name: bp.name, email: bp.email ?? '', phone: bp.phone ?? '',
      account_number: bp.account_number ?? '', ifsc: bp.ifsc ?? '',
      gstin: bp.gstin ?? '', pan: bp.pan ?? '', service_type_id: bp.service_type_id ?? '',
      unit_id: '',
      opening_balance: bp.opening_balance != null ? String(bp.opening_balance) : '',
      opening_balance_type: bp.opening_balance_type ?? 'DEBIT',
      opening_balance_date: bp.opening_balance_date ? bp.opening_balance_date.slice(0, 10) : '',
    });
    setEditError('');
  };

  const handleSaveEdit = async (bp: BusinessPartner) => {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    try { await onUpdate(bp.id, buildBody(editForm)); setEditId(null); }
    catch (e: unknown) { setEditError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to update.'); }
  };

  const fmtOB = (bp: BusinessPartner) => {
    if (bp.opening_balance == null) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const side  = bp.opening_balance_type === 'DEBIT' ? 'DR' : 'CR';
    const color = bp.opening_balance_type === 'DEBIT' ? '#185fa5' : '#a32d2d';
    return <span style={{ color, fontFamily: 'monospace', fontSize: 12.5 }}>₹{Number(bp.opening_balance).toLocaleString('en-IN')} {side}</span>;
  };

  return (
    <>
      {showAdd && (
        <BPFormPanel
          category={category} title={`New ${label}`}
          form={addForm} onChange={setAddForm}
          onSave={handleAdd} onCancel={onHideAdd}
          isSaving={false} error={addError} serviceTypes={serviceTypes}
        />
      )}

      {bps.length === 0 && !showAdd ? (
        <div style={{ padding: '13px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No records yet.</div>
      ) : bps.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Code</th><th style={th}>Name</th>
              {category === 'BANK'   && <><th style={th}>Account no.</th><th style={th}>IFSC</th></>}
              {category === 'VENDOR' && <><th style={th}>Service type</th><th style={th}>GSTIN</th><th style={th}>PAN</th></>}
              <th style={{ ...th, textAlign: 'right' }}>Opening balance</th>
              <th style={th}>As-on</th><th style={th}>Status</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {bps.map((bp, idx) => (
              editId === bp.id ? (
                <tr key={bp.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                  <td colSpan={99} style={{ padding: 0 }}>
                    <BPFormPanel
                      category={category} title={`Edit — ${bp.code} ${bp.name}`}
                      form={editForm} onChange={setEditForm}
                      onSave={() => handleSaveEdit(bp)} onCancel={() => setEditId(null)}
                      isSaving={false} error={editError} serviceTypes={serviceTypes}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={bp.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', opacity: bp.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{bp.code}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1e293b' }}>{bp.name}</td>
                  {category === 'BANK' && (
                    <>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.account_number ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.ifsc ?? '—'}</td>
                    </>
                  )}
                  {category === 'VENDOR' && (
                    <>
                      <td style={{ padding: '10px 14px' }}>
                        {bp.service_type
                          ? <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#f0fdf4', color: '#15803d' }}>{bp.service_type.name}</span>
                          : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.gstin ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.pan ?? '—'}</td>
                    </>
                  )}
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmtOB(bp)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                    {bp.opening_balance_date ? new Date(bp.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: bp.is_active ? '#dcfce7' : '#f1f5f9', color: bp.is_active ? '#15803d' : '#64748b' }}>
                      {bp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button style={btnIcon} title="Edit" onClick={() => startEdit(bp)}><i className="ti ti-pencil" aria-hidden="true" /></button>
                      <button style={btnIcon} title={bp.is_active ? 'Deactivate' : 'Activate'} onClick={() => onToggle(bp.id)}>
                        <i className={`ti ${bp.is_active ? 'ti-power' : 'ti-refresh'}`} aria-hidden="true" />
                      </button>
                      <button style={{ ...btnIcon, color: '#dc2626' }} title="Delete" onClick={() => setDeleteTarget(bp)}>
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}

      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.5rem', width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete business partner?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
              <strong>{deleteTarget.code} — {deleteTarget.name}</strong><br />Cannot be deleted if journal entries exist.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }} style={{ flex: 1, padding: 8, borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: 8, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Service Types sub-panel (inline, no card wrapper) ─────────────────────────
function ServiceTypesList({ serviceTypes }: { serviceTypes: ServiceType[] }) {
  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [addError, setAddError]   = useState('');
  const [editId, setEditId]       = useState<string | null>(null);
  const [editName, setEditName]   = useState('');
  const [editDesc, setEditDesc]   = useState('');
  const [editError, setEditError] = useState('');
  const [createST] = useCreateServiceTypeMutation();
  const [updateST] = useUpdateServiceTypeMutation();
  const [toggleST] = useToggleServiceTypeMutation();
  const [deleteST] = useDeleteServiceTypeMutation();

  const handleAdd = async () => {
    if (!newName.trim()) { setAddError('Name is required.'); return; }
    try {
      await createST({ name: newName.trim(), description: newDesc.trim() || null }).unwrap();
      setNewName(''); setNewDesc(''); setShowAdd(false); setAddError('');
    } catch (e: unknown) {
      setAddError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to save.');
    }
  };

  const startEdit = (st: ServiceType) => {
    setEditId(st.id); setEditName(st.name); setEditDesc(st.description ?? ''); setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    try {
      await updateST({ id: editId!, name: editName.trim(), description: editDesc.trim() || null }).unwrap();
      setEditId(null); setEditError('');
    } catch (e: unknown) {
      setEditError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to update.');
    }
  };

  return (
    <div style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #fef08a' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <i className="ti ti-tag" style={{ fontSize: 13, marginRight: 5 }} aria-hidden="true" />
          Service types — {serviceTypes.length} defined
        </span>
        <button onClick={() => { setShowAdd(v => !v); setNewName(''); setNewDesc(''); setAddError(''); }} style={btn()}>
          <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add type
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #fef08a', background: '#fefce8' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0 10px', marginBottom: 8 }}>
            <div><label style={fl}>Name *</label><input style={fc} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Electrical, Plumbing" autoFocus /></div>
            <div><label style={fl}>Description</label><input style={fc} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional" /></div>
          </div>
          {addError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} style={btn(true)}>Save</button>
            <button onClick={() => setShowAdd(false)} style={btn()}>Cancel</button>
          </div>
        </div>
      )}

      {serviceTypes.length === 0 && !showAdd ? (
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No service types yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, background: '#fffbeb' }}>Name</th>
              <th style={{ ...th, background: '#fffbeb' }}>Description</th>
              <th style={{ ...th, background: '#fffbeb' }}>Status</th>
              <th style={{ ...th, background: '#fffbeb' }}></th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.map((st, idx) => (
              editId === st.id ? (
                <tr key={st.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #fef08a', background: '#fefce8' }}>
                  <td style={{ padding: '8px 14px' }}><input style={{ ...fc, width: 160 }} value={editName} onChange={e => setEditName(e.target.value)} /></td>
                  <td style={{ padding: '8px 14px' }}><input style={fc} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" /></td>
                  <td colSpan={2} style={{ padding: '8px 14px' }}>
                    {editError && <span style={{ fontSize: 12, color: '#dc2626', marginRight: 8 }}>{editError}</span>}
                    <button onClick={handleSaveEdit} style={btn(true)}>Save</button>
                    <button onClick={() => setEditId(null)} style={{ ...btn(), marginLeft: 6 }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={st.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #fef9c3', opacity: st.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '8px 14px', fontWeight: 500, color: '#1e293b' }}>{st.name}</td>
                  <td style={{ padding: '8px 14px', fontSize: 12, color: '#64748b' }}>{st.description ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: st.is_active ? '#f0fdf4' : '#f1f5f9', color: st.is_active ? '#15803d' : '#64748b' }}>
                      {st.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button style={btnIcon} title="Edit" onClick={() => startEdit(st)}><i className="ti ti-pencil" aria-hidden="true" /></button>
                      <button style={btnIcon} title={st.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleST(st.id)}>
                        <i className={`ti ${st.is_active ? 'ti-power' : 'ti-refresh'}`} aria-hidden="true" />
                      </button>
                      <button style={{ ...btnIcon, color: '#dc2626' }} title="Delete" onClick={() => deleteST(st.id)}>
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Vendor upload sub-panel (inline) ──────────────────────────────────────────
function VendorUploadPanel({ token }: { token: string | null }) {
  const fileRef                       = useRef<HTMLInputElement>(null);
  const [preview, setPreview]         = useState<VendorUploadPreviewRow[] | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadErr, setUploadErr]     = useState('');
  const [result, setResult]           = useState<{ created: number; updated: number } | null>(null);
  const [previewVendors]              = usePreviewVendorUploadMutation();
  const [applyVendors, { isLoading: applying }] = useApplyVendorUploadMutation();

  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/vendors/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'SmartAppt_Vendor_Template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setUploadErr(`Download failed: ${(err as Error).message}`); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(null); setResult(null); setUploadErr(''); setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await previewVendors(fd).unwrap();
      setPreview(res.data);
    } catch (err: unknown) {
      setUploadErr((err as { data?: { message?: string } })?.data?.message ?? 'Failed to parse file');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    const toApply = preview.filter(r => r.status === 'create' || r.status === 'update');
    try {
      const res = await applyVendors(toApply).unwrap();
      setResult(res.data); setPreview(null);
    } catch (err: unknown) {
      setUploadErr((err as { data?: { message?: string } })?.data?.message ?? 'Failed to apply');
    }
  };

  const sBg  = (s: VendorUploadPreviewRow['status']) => ({ create: '#f0fdf4', update: '#eff6ff', error: '#fef2f2', skip: '#f8fafc' }[s]);
  const sClr = (s: VendorUploadPreviewRow['status']) => ({ create: '#15803d', update: '#1d4ed8', error: '#dc2626', skip: '#64748b' }[s]);
  const toApplyCount = preview?.filter(r => r.status === 'create' || r.status === 'update').length ?? 0;
  const errorCount   = preview?.filter(r => r.status === 'error').length ?? 0;

  return (
    <div style={{ borderBottom: '1px solid #e2e8f0', background: '#f0f9ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid #bae6fd' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <i className="ti ti-upload" style={{ fontSize: 13, marginRight: 5 }} aria-hidden="true" />
          Bulk upload
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleDownload} style={btn()}>
            <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" /> Template
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...btn(), opacity: uploading ? 0.7 : 1 }}>
            <i className="ti ti-file-upload" style={{ fontSize: 13 }} aria-hidden="true" /> {uploading ? 'Reading…' : 'Upload file'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      </div>

      {result && (
        <div style={{ padding: '10px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', gap: 16, alignItems: 'center' }}>
          <i className="ti ti-circle-check" style={{ color: '#15803d', fontSize: 18 }} />
          <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
            {result.created} vendor{result.created !== 1 ? 's' : ''} created · {result.updated} updated
          </span>
          <button onClick={() => setResult(null)} style={{ ...btn(), marginLeft: 'auto' }}>Dismiss</button>
        </div>
      )}
      {uploadErr && (
        <div style={{ padding: '9px 16px', background: '#fef2f2', color: '#dc2626', fontSize: 12.5, borderBottom: '1px solid #fecaca' }}>{uploadErr}</div>
      )}

      {preview && preview.length > 0 && (
        <>
          <div style={{ padding: '9px 16px', background: '#fffbeb', borderBottom: '1px solid #fef08a', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: '#92400e' }}>
              <strong>{toApplyCount}</strong> will be saved
              {errorCount > 0 && <> · <strong style={{ color: '#dc2626' }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</strong> (fix and re-upload)</>}
            </span>
            {toApplyCount > 0 && (
              <button onClick={handleApply} disabled={applying} style={{ ...btn(true), marginLeft: 'auto', opacity: applying ? 0.7 : 1 }}>
                {applying ? 'Saving…' : `Apply ${toApplyCount} row${toApplyCount !== 1 ? 's' : ''}`}
              </button>
            )}
            <button onClick={() => setPreview(null)} style={btn()}>Clear</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={th}>Row</th><th style={th}>Status</th>
                  <th style={th}>Code</th><th style={th}>Name</th>
                  <th style={th}>Service type</th><th style={th}>GSTIN</th><th style={th}>PAN</th>
                  <th style={{ ...th, textAlign: 'right' }}>Opening bal</th>
                  <th style={th}>DR/CR</th><th style={th}>Date</th><th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {preview.map(r => (
                  <tr key={r.row_num} style={{ borderTop: '1px solid #f1f5f9', background: r.status === 'error' ? '#fff5f5' : undefined }}>
                    <td style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 11 }}>{r.row_num}</td>
                    <td style={{ padding: '6px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: sBg(r.status), color: sClr(r.status), textTransform: 'uppercase' }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '6px 14px', fontFamily: 'monospace', fontSize: 12 }}>{r.code}</td>
                    <td style={{ padding: '6px 14px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '6px 14px', color: '#64748b' }}>{r.service_type_name ?? '—'}</td>
                    <td style={{ padding: '6px 14px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{r.gstin ?? '—'}</td>
                    <td style={{ padding: '6px 14px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{r.pan ?? '—'}</td>
                    <td style={{ padding: '6px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                      {r.opening_balance != null ? `₹${Number(r.opening_balance).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '6px 14px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: r.opening_balance_type === 'DEBIT' ? '#1d4ed8' : r.opening_balance_type === 'CREDIT' ? '#15803d' : '#94a3b8' }}>
                      {r.opening_balance_type === 'DEBIT' ? 'DR' : r.opening_balance_type === 'CREDIT' ? 'CR' : '—'}
                    </td>
                    <td style={{ padding: '6px 14px', fontSize: 11, color: '#64748b' }}>
                      {r.opening_balance_date ? new Date(r.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '6px 14px', fontSize: 11, color: '#dc2626' }}>{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {preview && preview.length === 0 && (
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No data rows found in the uploaded file.</div>
      )}
    </div>
  );
}

// ── Units / Flats section (inner body) ────────────────────────────────────────
function UnitBody({ token }: { token: string | null }) {
  const { data: unitsData, refetch } = useListUnitsWithBalancesQuery();
  const [applyUpload, { isLoading: isApplying }] = useApplyUnitOBUploadMutation();
  const [showUpload, setShowUpload]     = useState(false);
  const [dragging, setDragging]         = useState(false);
  const [previewRows, setPreviewRows]   = useState<UnitOBPreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const units = unitsData?.data ?? [];

  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/bp-masters/units/template`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'SmartAppt_UnitOB_Template.xlsx';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { setPreviewError('Failed to download template.'); }
  };

  const processFile = async (file: File) => {
    setPreviewLoading(true); setPreviewError(''); setPreviewRows(null);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/accounting/bp-masters/units/upload/preview`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPreviewRows(json.data);
    } catch (e) { setPreviewError(`Parse error: ${String(e)}`); }
    finally { setPreviewLoading(false); }
  };

  const handleApply = async () => {
    if (!previewRows) return;
    const toSave = previewRows.filter(r => r.status === 'create' || r.status === 'update');
    try {
      const res = await applyUpload(toSave).unwrap();
      setSuccessMsg(`Done — ${res.data.created} created, ${res.data.updated} updated.`);
      setPreviewRows(null); setShowUpload(false); refetch();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch { setPreviewError('Apply failed.'); }
  };

  const previewStats = previewRows ? {
    create: previewRows.filter(r => r.status === 'create').length,
    update: previewRows.filter(r => r.status === 'update').length,
    skip:   previewRows.filter(r => r.status === 'skip').length,
    error:  previewRows.filter(r => r.status === 'error').length,
  } : null;

  const fmtOB = (u: UnitWithBalance) => {
    if (u.opening_balance == null) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const side  = u.opening_balance_type === 'DEBIT' ? 'DR' : 'CR';
    const color = u.opening_balance_type === 'DEBIT' ? '#185fa5' : '#a32d2d';
    return <span style={{ color, fontFamily: 'monospace', fontSize: 12.5 }}>₹{u.opening_balance.toLocaleString('en-IN')} {side}</span>;
  };

  const statusBadge = (s: UnitOBPreviewRow['status']) => {
    const map: Record<string, [string, string]> = { create: ['#dcfce7', '#15803d'], update: ['#dbeafe', '#1d4ed8'], skip: ['#f1f5f9', '#64748b'], error: ['#fee2e2', '#dc2626'] };
    const [bg, color] = map[s];
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: bg, color }}>{s}</span>;
  };

  return (
    <>
      {/* Upload sub-panel header buttons */}
      <div style={{ display: 'flex', gap: 8, padding: '9px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <button onClick={handleDownload} style={btn()}>
          <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" /> Download template
        </button>
        <button onClick={() => { setShowUpload(v => !v); setPreviewRows(null); setPreviewError(''); }} style={btn()}>
          <i className="ti ti-upload" style={{ fontSize: 13 }} aria-hidden="true" /> Upload balances
        </button>
      </div>

      {successMsg && (
        <div style={{ padding: '8px 16px', background: '#dcfce7', borderBottom: '1px solid #bbf7d0', fontSize: 13, color: '#15803d', fontWeight: 500 }}>
          <i className="ti ti-circle-check" style={{ marginRight: 6 }} /> {successMsg}
        </div>
      )}

      {showUpload && (
        <div style={{ borderBottom: '1px solid #e2e8f0', padding: '14px 16px', background: '#f0f9ff' }}>
          <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px' }}>
            Download the template, fill in Opening Balance / DR/CR / Date for each unit, then upload here.
          </div>
          {!previewRows && !previewLoading && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
                style={{ border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`, borderRadius: 8, padding: '20px 16px', textAlign: 'center', background: dragging ? '#eff6ff' : '#fff', cursor: 'pointer' }}
              >
                <i className="ti ti-file-spreadsheet" style={{ fontSize: 26, color: dragging ? '#2563eb' : '#94a3b8', display: 'block', marginBottom: 6 }} aria-hidden="true" />
                <div style={{ fontSize: 13, color: '#475569' }}>Drop file or <span style={{ color: '#2563eb', textDecoration: 'underline' }}>click to browse</span></div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>.xlsx files only · max 5 MB</div>
              </div>
            </>
          )}
          {previewLoading && <div style={{ padding: '16px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>Parsing file…</div>}
          {previewError && <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 7, fontSize: 12.5, color: '#dc2626' }}>{previewError}</div>}
          {previewRows && previewStats && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[{ label: 'To Create', count: previewStats.create, bg: '#dcfce7', color: '#15803d' }, { label: 'To Update', count: previewStats.update, bg: '#dbeafe', color: '#1d4ed8' }, { label: 'Skipped', count: previewStats.skip, bg: '#f1f5f9', color: '#64748b' }, { label: 'Errors', count: previewStats.error, bg: '#fee2e2', color: '#dc2626' }].map(s => (
                  <div key={s.label} style={{ flex: 1, borderRadius: 8, padding: '8px 12px', background: s.bg, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 7, marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                    <tr><th style={th}>Flat</th><th style={th}>Block</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Side</th><th style={th}>Date</th><th style={th}>Status</th><th style={th}>Note</th></tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 14px', fontWeight: 500 }}>{r.flat_number}</td>
                        <td style={{ padding: '6px 14px', color: '#64748b' }}>{r.block ?? '—'}</td>
                        <td style={{ padding: '6px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{r.opening_balance != null ? `₹${r.opening_balance.toLocaleString('en-IN')}` : '—'}</td>
                        <td style={{ padding: '6px 14px' }}>{r.opening_balance_type === 'DEBIT' ? <span style={{ color: '#185fa5' }}>DR</span> : r.opening_balance_type === 'CREDIT' ? <span style={{ color: '#a32d2d' }}>CR</span> : '—'}</td>
                        <td style={{ padding: '6px 14px', color: '#64748b', fontSize: 12 }}>{r.opening_balance_date ? new Date(r.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '6px 14px' }}>{statusBadge(r.status)}</td>
                        <td style={{ padding: '6px 14px', fontSize: 11.5, color: '#dc2626' }}>{r.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleApply} disabled={isApplying || (previewStats.create + previewStats.update === 0)} style={{ ...btn(true), opacity: (isApplying || previewStats.create + previewStats.update === 0) ? 0.6 : 1 }}>
                  {isApplying ? 'Applying…' : `Apply (${previewStats.create + previewStats.update} records)`}
                </button>
                <button onClick={() => { setPreviewRows(null); setPreviewError(''); }} style={btn()}>← Different file</button>
                <button onClick={() => { setShowUpload(false); setPreviewRows(null); }} style={btn()}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {units.length === 0 ? (
        <div style={{ padding: '13px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No units found. Add units in Unit Management first.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Flat</th><th style={th}>Block</th><th style={th}>Floor</th>
              <th style={th}>Type</th><th style={th}>Owner / Resident</th>
              <th style={{ ...th, textAlign: 'right' }}>Opening balance</th><th style={th}>As-on</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u, idx) => (
              <tr key={u.unit_id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', background: u.opening_balance != null ? '#fff' : '#fafbfc' }}>
                <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1e293b' }}>{u.flat_number}</td>
                <td style={{ padding: '9px 14px', color: '#64748b' }}>{u.block ?? '—'}</td>
                <td style={{ padding: '9px 14px', color: '#64748b' }}>{u.floor}</td>
                <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12 }}>{u.unit_type ?? '—'}</td>
                <td style={{ padding: '9px 14px', color: '#475569' }}>{u.owner_name ?? <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No owner linked</span>}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>{fmtOB(u)}</td>
                <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b' }}>
                  {u.opening_balance_date ? new Date(u.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : <span style={{ color: '#cbd5e1' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BusinessPartnersPage() {
  const token              = useSelector((s: RootState) => s.auth.access_token);
  const { data, isLoading }   = useListBPMastersQuery({});
  const { data: stData }      = useListServiceTypesQuery();
  const [createBP] = useCreateBPMasterMutation();
  const [updateBP] = useUpdateBPMasterMutation();
  const [toggleBP] = useToggleBPMasterMutation();
  const [deleteBP] = useDeleteBPMasterMutation();

  const allBPs       = data?.data ?? [];
  const serviceTypes = stData?.data ?? [];
  const banks        = allBPs.filter(bp => bp.bp_category === 'BANK');
  const vendors      = allBPs.filter(bp => bp.bp_category === 'VENDOR');

  // Accordion open states — all collapsed by default
  const [bankOpen,   setBankOpen]   = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [showST,     setShowST]     = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showBankAdd,   setShowBankAdd]   = useState(false);
  const [showVendorAdd, setShowVendorAdd] = useState(false);
  const [unitOpen,   setUnitOpen]   = useState(false);

  const handleVendorTemplateDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/vendors/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'SmartAppt_Vendor_Template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('[Vendor template]', err); }
  };

  const onBP = async (body: object) => { await createBP(body as Partial<BusinessPartner>).unwrap(); };
  const onBPUpdate = async (id: string, body: object) => { await updateBP({ id, body: body as Partial<BusinessPartner> }).unwrap(); };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Business Partners' }]} />
      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1060 }}>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
          Sub-ledger masters for Banks, Vendors, and Units. Opening balances flow into the GL control account.
        </div>

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : (
          <>
            {/* ── Banks ─────────────────────────────────────────────────── */}
            <AccordionSection
              icon="ti-building-bank" iconBg="#e6f1fb" iconColor="#185fa5"
              title="Banks" subtitle={`${banks.length} record${banks.length !== 1 ? 's' : ''}`}
              isOpen={bankOpen} onToggle={() => setBankOpen(v => !v)}
              headerActions={
                <button onClick={() => { setBankOpen(true); setShowBankAdd(v => !v); }} style={btn()}>
                  <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add
                </button>
              }
            >
              <BPList
                category="BANK" bps={banks} serviceTypes={serviceTypes}
                showAdd={showBankAdd} onHideAdd={() => setShowBankAdd(false)}
                onCreate={onBP} onUpdate={onBPUpdate}
                onToggle={id => toggleBP(id)} onDelete={id => deleteBP(id)}
              />
            </AccordionSection>

            {/* ── Vendors ───────────────────────────────────────────────── */}
            <AccordionSection
              icon="ti-truck" iconBg="#eaf3de" iconColor="#3b6d11"
              title="Vendors"
              subtitle={`${vendors.length} record${vendors.length !== 1 ? 's' : ''} · ${serviceTypes.length} service type${serviceTypes.length !== 1 ? 's' : ''}`}
              isOpen={vendorOpen} onToggle={() => setVendorOpen(v => !v)}
              headerActions={
                <>
                  <button
                    onClick={() => { setVendorOpen(true); setShowST(v => !v); setShowUpload(false); }}
                    style={{ ...btn(), background: showST ? '#fef9c3' : undefined, borderColor: showST ? '#fef08a' : undefined }}
                    title="Manage service types"
                  >
                    <i className="ti ti-tag" style={{ fontSize: 13 }} aria-hidden="true" /> Service types
                  </button>
                  <button
                    onClick={handleVendorTemplateDownload}
                    style={btn()}
                    title="Download vendor bulk upload template"
                  >
                    <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" /> Template
                  </button>
                  <button
                    onClick={() => { setVendorOpen(true); setShowUpload(v => !v); setShowST(false); }}
                    style={{ ...btn(), background: showUpload ? '#e0f2fe' : undefined, borderColor: showUpload ? '#bae6fd' : undefined }}
                    title="Bulk upload vendors"
                  >
                    <i className="ti ti-upload" style={{ fontSize: 13 }} aria-hidden="true" /> Upload
                  </button>
                  <button onClick={() => { setVendorOpen(true); setShowVendorAdd(v => !v); }} style={btn()}>
                    <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add
                  </button>
                </>
              }
            >
              {showST    && <ServiceTypesList serviceTypes={serviceTypes} />}
              {showUpload && <VendorUploadPanel token={token} />}
              <BPList
                category="VENDOR" bps={vendors} serviceTypes={serviceTypes}
                showAdd={showVendorAdd} onHideAdd={() => setShowVendorAdd(false)}
                onCreate={onBP} onUpdate={onBPUpdate}
                onToggle={id => toggleBP(id)} onDelete={id => deleteBP(id)}
              />
            </AccordionSection>

            {/* ── Units / Flats ─────────────────────────────────────────── */}
            <AccordionSection
              icon="ti-building" iconBg="#eeedfe" iconColor="#534ab7"
              title="Units / Flats"
              subtitle="Opening balances &amp; overview"
              isOpen={unitOpen} onToggle={() => setUnitOpen(v => !v)}
            >
              <UnitBody token={token} />
            </AccordionSection>
          </>
        )}
      </div>
    </Layout>
  );
}
