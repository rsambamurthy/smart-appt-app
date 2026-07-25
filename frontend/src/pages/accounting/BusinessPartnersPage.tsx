import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { API_BASE } from '../../store/api/baseApi';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListBPMastersQuery, useCreateBPMasterMutation,
  useUpdateBPMasterMutation, useToggleBPMasterMutation,
  useDeleteBPMasterMutation, useListUnitOptionsQuery,
  useListUnitsWithBalancesQuery, useApplyUnitOBUploadMutation,
  useListServiceTypesQuery, useCreateServiceTypeMutation,
  useUpdateServiceTypeMutation, useToggleServiceTypeMutation, useDeleteServiceTypeMutation,
  BusinessPartner, BPCategory, BalanceType, UnitWithBalance, UnitOBPreviewRow, ServiceType,
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

// ── Styles ────────────────────────────────────────────────────────────────────
const fl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };
const fc: React.CSSProperties = { width: '100%', padding: '6px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' };
const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7,
  border: primary ? 'none' : danger ? '1px solid #fecaca' : '1px solid #e2e8f0',
  background: primary ? '#2563eb' : danger ? '#fef2f2' : '#fff',
  color: primary ? '#fff' : danger ? '#dc2626' : '#475569',
  fontSize: 12.5, fontWeight: primary ? 500 : 400, cursor: 'pointer',
});
const th: React.CSSProperties = { padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const btnIcon: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8', padding: '2px 4px', borderRadius: 4 };

// ── BP form component (used for Banks and Vendors) ────────────────────────────
function BPFormPanel({
  category, form, onChange, onSave, onCancel, isSaving, error, unitOptions, serviceTypes, title,
}: {
  category: BPCategory; form: BPForm; onChange: (f: BPForm) => void;
  onSave: () => void; onCancel: () => void;
  isSaving: boolean; error: string;
  unitOptions: { id: string; flat_number: string; block: string | null }[];
  serviceTypes: ServiceType[];
  title: string;
}) {
  const set = (p: Partial<BPForm>) => onChange({ ...form, ...p });
  return (
    <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 16px' }}>
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
                <button key={side} onClick={() => set({ opening_balance_type: side })} style={{ flex: 1, border: 'none', borderRight: side === 'DEBIT' ? '1px solid #e2e8f0' : 'none', background: form.opening_balance_type === side ? '#2563eb' : '#fff', color: form.opening_balance_type === side ? '#fff' : '#475569', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{side === 'DEBIT' ? 'DR' : 'CR'}</button>
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

// ── Generic BP section (Banks, Vendors) ───────────────────────────────────────
function BPSection({
  category, label, icon, iconBg, iconColor,
  bps, unitOptions, serviceTypes, onCreate, onUpdate, onToggle, onDelete,
}: {
  category: BPCategory; label: string; icon: string; iconBg: string; iconColor: string;
  bps: BusinessPartner[];
  unitOptions: { id: string; flat_number: string; block: string | null }[];
  serviceTypes: ServiceType[];
  onCreate: (body: object) => Promise<void>;
  onUpdate: (id: string, body: object) => Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState(emptyForm());
  const [addError, setAddError] = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BusinessPartner | null>(null);

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
    try { await onCreate(buildBody(addForm)); setAddForm(emptyForm()); setShowAdd(false); }
    catch (e: unknown) { setAddError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to save.'); }
  };

  const startEdit = (bp: BusinessPartner) => {
    setEditId(bp.id);
    setEditForm({ code: bp.code, name: bp.name, email: bp.email ?? '', phone: bp.phone ?? '', account_number: bp.account_number ?? '', ifsc: bp.ifsc ?? '', gstin: bp.gstin ?? '', pan: bp.pan ?? '', service_type_id: bp.service_type_id ?? '', unit_id: '', opening_balance: bp.opening_balance != null ? String(bp.opening_balance) : '', opening_balance_type: bp.opening_balance_type ?? 'DEBIT', opening_balance_date: bp.opening_balance_date ? bp.opening_balance_date.slice(0, 10) : '' });
    setEditError('');
  };

  const handleSaveEdit = async (bp: BusinessPartner) => {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    try { await onUpdate(bp.id, buildBody(editForm)); setEditId(null); }
    catch (e: unknown) { setEditError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to update.'); }
  };

  const formatOB = (bp: BusinessPartner) => {
    if (bp.opening_balance == null) return '—';
    const side  = bp.opening_balance_type === 'DEBIT' ? 'DR' : 'CR';
    const color = bp.opening_balance_type === 'DEBIT' ? '#185fa5' : '#a32d2d';
    return <span style={{ color, fontFamily: 'monospace', fontSize: 12.5 }}>₹{Number(bp.opening_balance).toLocaleString('en-IN')} {side}</span>;
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            <i className={`ti ${icon}`} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>{bps.length} record{bps.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button onClick={() => { setShowAdd(v => !v); setAddForm(emptyForm()); setAddError(''); }} style={btn()}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Add
        </button>
      </div>

      {showAdd && (
        <BPFormPanel category={category} title={`New ${label.toLowerCase().slice(0, -1)}`} form={addForm} onChange={setAddForm} onSave={handleAdd} onCancel={() => setShowAdd(false)} isSaving={false} error={addError} unitOptions={unitOptions} serviceTypes={serviceTypes} />
      )}

      {bps.length === 0 && !showAdd ? (
        <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No records yet.</div>
      ) : bps.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Code</th><th style={th}>Name</th>
              {category === 'BANK'   && <><th style={th}>Account no.</th><th style={th}>IFSC</th></>}
              {category === 'VENDOR' && <><th style={th}>Service Type</th><th style={th}>GSTIN</th><th style={th}>PAN</th></>}
              <th style={{ ...th, textAlign: 'right' }}>Opening balance</th>
              <th style={th}>As-on date</th><th style={th}>Status</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {bps.map((bp, idx) => (
              editId === bp.id ? (
                <tr key={bp.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                  <td colSpan={99} style={{ padding: 0 }}>
                    <BPFormPanel category={category} title={`Edit — ${bp.code} ${bp.name}`} form={editForm} onChange={setEditForm} onSave={() => handleSaveEdit(bp)} onCancel={() => setEditId(null)} isSaving={false} error={editError} unitOptions={unitOptions} serviceTypes={serviceTypes} />
                  </td>
                </tr>
              ) : (
                <tr key={bp.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', opacity: bp.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{bp.code}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1e293b' }}>{bp.name}</td>
                  {category === 'BANK' && (
                    <><td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.account_number ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.ifsc ?? '—'}</td></>
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
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatOB(bp)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                    {bp.opening_balance_date ? new Date(bp.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: bp.is_active ? '#dcfce7' : '#f1f5f9', color: bp.is_active ? '#15803d' : '#64748b' }}>
                      {bp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={btnIcon} title="Edit" onClick={() => startEdit(bp)}>✎</button>
                      <button style={btnIcon} title={bp.is_active ? 'Deactivate' : 'Activate'} onClick={() => onToggle(bp.id)}>{bp.is_active ? '⊗' : '↺'}</button>
                      <button style={{ ...btnIcon, color: '#dc2626' }} title="Delete" onClick={() => setDeleteTarget(bp)}>🗑</button>
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
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}><strong>{deleteTarget.code} — {deleteTarget.name}</strong><br />Cannot be deleted if journal entries exist.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }} style={{ flex: 1, padding: 8, borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: 8, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Units / Flats section ─────────────────────────────────────────────────────
function UnitSection({ token }: { token: string | null }) {
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
  const withBalance = units.filter(u => u.opening_balance != null).length;

  // ── Download template ──────────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/bp-masters/units/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'SmartAppt_UnitOB_Template.xlsx';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { setPreviewError('Failed to download template.'); }
  };

  // ── Process file: send to preview endpoint ─────────────────────────────────
  const processFile = async (file: File) => {
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewRows(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/accounting/bp-masters/units/upload/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPreviewRows(json.data);
    } catch (e) {
      setPreviewError(`Parse error: ${String(e)}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Apply confirmed rows ───────────────────────────────────────────────────
  const handleApply = async () => {
    if (!previewRows) return;
    const toSave = previewRows.filter(r => r.status === 'create' || r.status === 'update');
    try {
      const res = await applyUpload(toSave).unwrap();
      setSuccessMsg(`Done — ${res.data.created} created, ${res.data.updated} updated.`);
      setPreviewRows(null);
      setShowUpload(false);
      refetch();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch { setPreviewError('Apply failed. Please try again.'); }
  };

  const previewStats = previewRows
    ? {
        create: previewRows.filter(r => r.status === 'create').length,
        update: previewRows.filter(r => r.status === 'update').length,
        skip:   previewRows.filter(r => r.status === 'skip').length,
        error:  previewRows.filter(r => r.status === 'error').length,
      }
    : null;

  const fmtOB = (u: UnitWithBalance) => {
    if (u.opening_balance == null) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const side  = u.opening_balance_type === 'DEBIT' ? 'DR' : 'CR';
    const color = u.opening_balance_type === 'DEBIT' ? '#185fa5' : '#a32d2d';
    return <span style={{ color, fontFamily: 'monospace', fontSize: 12.5 }}>₹{u.opening_balance.toLocaleString('en-IN')} {side}</span>;
  };

  const statusBadge = (s: UnitOBPreviewRow['status']) => {
    const map: Record<string, [string, string]> = {
      create: ['#dcfce7', '#15803d'],
      update: ['#dbeafe', '#1d4ed8'],
      skip:   ['#f1f5f9', '#64748b'],
      error:  ['#fee2e2', '#dc2626'],
    };
    const [bg, color] = map[s];
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: bg, color }}>{s}</span>;
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eeedfe', color: '#534ab7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            <i className="ti ti-building" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Units / Flats</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              {units.length} unit{units.length !== 1 ? 's' : ''} · {withBalance} with opening balance
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownload} style={btn()}>
            <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" /> Download Template
          </button>
          <button onClick={() => { setShowUpload(v => !v); setPreviewRows(null); setPreviewError(''); }} style={btn()}>
            <i className="ti ti-upload" style={{ fontSize: 13 }} aria-hidden="true" /> Upload Balances
          </button>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ padding: '8px 16px', background: '#dcfce7', borderBottom: '1px solid #bbf7d0', fontSize: 13, color: '#15803d', fontWeight: 500 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div style={{ borderBottom: '1px solid #e2e8f0', padding: '14px 16px', background: '#fafbfc' }}>

          {/* Info notice */}
          <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px' }}>
            <strong>How it works:</strong> Download the template, fill in the <em>Opening Balance</em>, <em>DR/CR</em>, and <em>As On Date</em> columns for each unit, then upload the file here.
          </div>

          {/* Drop zone */}
          {!previewRows && !previewLoading && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragEnter={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`,
                  borderRadius: 8, padding: '24px 16px', textAlign: 'center',
                  background: dragging ? '#eff6ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <i className="ti ti-file-spreadsheet" style={{ fontSize: 28, color: dragging ? '#2563eb' : '#94a3b8', display: 'block', marginBottom: 6 }} aria-hidden="true" />
                <div style={{ fontSize: 13, color: '#475569' }}>Drop your filled template here, or <span style={{ color: '#2563eb', textDecoration: 'underline' }}>click to browse</span></div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>.xlsx files only · max 5 MB</div>
              </div>
            </>
          )}

          {/* Loading */}
          {previewLoading && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              <i className="ti ti-loader-2" style={{ fontSize: 20, display: 'block', marginBottom: 6, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
              Parsing file…
            </div>
          )}

          {/* Error */}
          {previewError && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 7, fontSize: 12.5, color: '#dc2626' }}>
              {previewError}
            </div>
          )}

          {/* Preview */}
          {previewRows && previewStats && (
            <div>
              {/* Stats */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'To Create',  count: previewStats.create, bg: '#dcfce7', color: '#15803d' },
                  { label: 'To Update',  count: previewStats.update, bg: '#dbeafe', color: '#1d4ed8' },
                  { label: 'Skipped',    count: previewStats.skip,   bg: '#f1f5f9', color: '#64748b' },
                  { label: 'Errors',     count: previewStats.error,  bg: '#fee2e2', color: '#dc2626' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, borderRadius: 8, padding: '8px 12px', background: s.bg, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Row table */}
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 7, marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                    <tr>
                      <th style={th}>Flat</th><th style={th}>Block</th>
                      <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                      <th style={th}>Side</th><th style={th}>Date</th>
                      <th style={th}>Status</th><th style={th}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 14px', fontWeight: 500 }}>{r.flat_number}</td>
                        <td style={{ padding: '6px 14px', color: '#64748b' }}>{r.block ?? '—'}</td>
                        <td style={{ padding: '6px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {r.opening_balance != null ? `₹${r.opening_balance.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '6px 14px' }}>
                          {r.opening_balance_type === 'DEBIT' ? <span style={{ color: '#185fa5' }}>DR</span> : r.opening_balance_type === 'CREDIT' ? <span style={{ color: '#a32d2d' }}>CR</span> : '—'}
                        </td>
                        <td style={{ padding: '6px 14px', color: '#64748b', fontSize: 12 }}>
                          {r.opening_balance_date ? new Date(r.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '6px 14px' }}>{statusBadge(r.status)}</td>
                        <td style={{ padding: '6px 14px', fontSize: 11.5, color: '#dc2626' }}>{r.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleApply}
                  disabled={isApplying || (previewStats.create + previewStats.update === 0)}
                  style={{ ...btn(true), opacity: (isApplying || previewStats.create + previewStats.update === 0) ? 0.6 : 1 }}
                >
                  {isApplying ? 'Applying…' : `Apply (${previewStats.create + previewStats.update} records)`}
                </button>
                <button onClick={() => { setPreviewRows(null); setPreviewError(''); }} style={btn()}>
                  ← Upload different file
                </button>
                <button onClick={() => { setShowUpload(false); setPreviewRows(null); }} style={btn()}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Units table */}
      {units.length === 0 ? (
        <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>
          No units found. Add units in Unit Management first.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Flat</th>
              <th style={th}>Block</th>
              <th style={th}>Floor</th>
              <th style={th}>Type</th>
              <th style={th}>Owner / Resident</th>
              <th style={{ ...th, textAlign: 'right' }}>Opening Balance</th>
              <th style={th}>As-on Date</th>
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
                  {u.opening_balance_date
                    ? new Date(u.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : <span style={{ color: '#cbd5e1' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Service Type management panel ─────────────────────────────────────────────
function ServiceTypesPanel({ serviceTypes }: { serviceTypes: ServiceType[] }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [addError, setAddError] = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState('');
  const [createST]  = useCreateServiceTypeMutation();
  const [updateST]  = useUpdateServiceTypeMutation();
  const [toggleST]  = useToggleServiceTypeMutation();
  const [deleteST]  = useDeleteServiceTypeMutation();

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
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fef9c3', color: '#854d0e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            <i className="ti ti-tag" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Service Types</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>{serviceTypes.length} type{serviceTypes.length !== 1 ? 's' : ''} — vendor category lookup</div>
          </div>
        </div>
        <button onClick={() => { setShowAdd(v => !v); setNewName(''); setNewDesc(''); setAddError(''); }} style={btn()}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Add
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fef08a', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 10px', marginBottom: 8 }}>
            <div><label style={fl}>Name *</label><input style={fc} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Electrical, Plumbing" /></div>
            <div><label style={fl}>Description</label><input style={fc} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" /></div>
          </div>
          {addError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} style={btn(true)}>Save</button>
            <button onClick={() => setShowAdd(false)} style={btn()}>Cancel</button>
          </div>
        </div>
      )}

      {serviceTypes.length === 0 && !showAdd ? (
        <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No service types yet. Add one to categorise your vendors.</div>
      ) : serviceTypes.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Name</th><th style={th}>Description</th><th style={th}>Status</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.map((st, idx) => (
              editId === st.id ? (
                <tr key={st.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', background: '#fffbeb' }}>
                  <td style={{ padding: '8px 14px' }}>
                    <input style={{ ...fc, width: 160 }} value={editName} onChange={e => setEditName(e.target.value)} />
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <input style={fc} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                  </td>
                  <td colSpan={2} style={{ padding: '8px 14px' }}>
                    {editError && <span style={{ fontSize: 12, color: '#dc2626', marginRight: 8 }}>{editError}</span>}
                    <button onClick={handleSaveEdit} style={btn(true)}>Save</button>
                    <button onClick={() => setEditId(null)} style={{ ...btn(), marginLeft: 6 }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={st.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', opacity: st.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1e293b' }}>{st.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{st.description ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: st.is_active ? '#f0fdf4' : '#f1f5f9', color: st.is_active ? '#15803d' : '#64748b' }}>
                      {st.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={btnIcon} title="Edit" onClick={() => startEdit(st)}>✎</button>
                      <button style={btnIcon} title={st.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleST(st.id)}>{st.is_active ? '⊗' : '↺'}</button>
                      <button style={{ ...btnIcon, color: '#dc2626' }} title="Delete" onClick={() => deleteST(st.id)}>🗑</button>
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

// ── Main page ─────────────────────────────────────────────────────────────────
const SECTIONS: { category: BPCategory; label: string; icon: string; iconBg: string; iconColor: string }[] = [
  { category: 'BANK',   label: 'Banks',   icon: 'ti-building-bank', iconBg: '#e6f1fb', iconColor: '#185fa5' },
  { category: 'VENDOR', label: 'Vendors', icon: 'ti-truck',         iconBg: '#eaf3de', iconColor: '#3b6d11' },
];

export default function BusinessPartnersPage() {
  const token                       = useSelector((s: RootState) => s.auth.access_token);
  const { data, isLoading }         = useListBPMastersQuery({});
  const { data: unitData }          = useListUnitOptionsQuery();
  const { data: stData }            = useListServiceTypesQuery();
  const [createBP]                  = useCreateBPMasterMutation();
  const [updateBP]                  = useUpdateBPMasterMutation();
  const [toggleBP]                  = useToggleBPMasterMutation();
  const [deleteBP]                  = useDeleteBPMasterMutation();

  const allBPs       = data?.data ?? [];
  const unitOptions  = (unitData?.data ?? []).map(u => ({ id: u.id, flat_number: u.flat_number, block: u.block }));
  const serviceTypes = stData?.data ?? [];
  const byCategory   = (cat: BPCategory) => allBPs.filter(bp => bp.bp_category === cat);

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Business Partners' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1060 }}>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
          Sub-ledger masters for Banks, Vendors, and Units / Flats. Opening balances here flow into the GL control account.
        </div>

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : (
          <>
            <ServiceTypesPanel serviceTypes={serviceTypes} />
            {SECTIONS.map(s => (
              <BPSection
                key={s.category} {...s}
                bps={byCategory(s.category)}
                unitOptions={unitOptions}
                serviceTypes={serviceTypes}
                onCreate={async (body) => { await createBP(body as Partial<BusinessPartner>).unwrap(); }}
                onUpdate={async (id, body) => { await updateBP({ id, body: body as Partial<BusinessPartner> }).unwrap(); }}
                onToggle={(id) => toggleBP(id)}
                onDelete={(id) => deleteBP(id)}
              />
            ))}
            <UnitSection token={token} />
          </>
        )}
      </div>
    </Layout>
  );
}
