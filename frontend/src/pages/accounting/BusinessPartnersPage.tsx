import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListBPMastersQuery, useCreateBPMasterMutation,
  useUpdateBPMasterMutation, useToggleBPMasterMutation,
  useDeleteBPMasterMutation, useListUnitOptionsQuery,
  BusinessPartner, BPCategory, BalanceType,
} from '../../store/api/accountingApi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BPForm {
  code: string; name: string; email: string; phone: string;
  // bank
  account_number: string; ifsc: string;
  // vendor
  gstin: string; pan: string;
  // unit
  unit_id: string;
  // opening balance
  opening_balance: string; opening_balance_type: BalanceType; opening_balance_date: string;
}
const emptyForm = (): BPForm => ({
  code: '', name: '', email: '', phone: '',
  account_number: '', ifsc: '', gstin: '', pan: '', unit_id: '',
  opening_balance: '', opening_balance_type: 'DEBIT', opening_balance_date: '',
});

// ── Section config ────────────────────────────────────────────────────────────
const SECTIONS: { category: BPCategory; label: string; icon: string; iconBg: string; iconColor: string }[] = [
  { category: 'BANK',   label: 'Banks',        icon: 'ti-building-bank', iconBg: '#e6f1fb', iconColor: '#185fa5' },
  { category: 'VENDOR', label: 'Vendors',       icon: 'ti-truck',         iconBg: '#eaf3de', iconColor: '#3b6d11' },
  { category: 'UNIT',   label: 'Units / Flats', icon: 'ti-building',      iconBg: '#eeedfe', iconColor: '#534ab7' },
];

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

// ── BP form component ─────────────────────────────────────────────────────────
function BPFormPanel({
  category, form, onChange, onSave, onCancel, isSaving, error, unitOptions, title,
}: {
  category: BPCategory; form: BPForm; onChange: (f: BPForm) => void;
  onSave: () => void; onCancel: () => void;
  isSaving: boolean; error: string; unitOptions: { id: string; flat_number: string; block: string | null }[]; title: string;
}) {
  const set = (p: Partial<BPForm>) => onChange({ ...form, ...p });

  return (
    <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '14px 16px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>{title}</div>

      {/* Row 1: Code + Name + contact */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', gap: '0 10px', marginBottom: 10 }}>
        <div><label style={fl}>Code</label><input style={fc} value={form.code} onChange={e => set({ code: e.target.value })} placeholder="BNK-001" /></div>
        <div><label style={fl}>Name</label><input style={fc} value={form.name} onChange={e => set({ name: e.target.value })} placeholder={category === 'BANK' ? 'HDFC – Current A/c' : category === 'VENDOR' ? 'ABC Electricals' : 'Flat A-101'} /></div>
        <div><label style={fl}>Phone</label><input style={fc} value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="9876543210" /></div>
        <div><label style={fl}>Email</label><input style={fc} value={form.email} onChange={e => set({ email: e.target.value })} placeholder="contact@example.com" /></div>
      </div>

      {/* Type-specific fields */}
      {category === 'BANK' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px', marginBottom: 10 }}>
          <div><label style={fl}>Account number</label><input style={fc} value={form.account_number} onChange={e => set({ account_number: e.target.value })} placeholder="00123456789" /></div>
          <div><label style={fl}>IFSC code</label><input style={fc} value={form.ifsc} onChange={e => set({ ifsc: e.target.value })} placeholder="HDFC0001234" /></div>
        </div>
      )}
      {category === 'VENDOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px', marginBottom: 10 }}>
          <div><label style={fl}>GSTIN</label><input style={fc} value={form.gstin} onChange={e => set({ gstin: e.target.value })} placeholder="29ABCDE1234F1Z5" /></div>
          <div><label style={fl}>PAN</label><input style={fc} value={form.pan} onChange={e => set({ pan: e.target.value })} placeholder="ABCDE1234F" /></div>
        </div>
      )}
      {category === 'UNIT' && (
        <div style={{ marginBottom: 10 }}>
          <label style={fl}>Link to unit / flat</label>
          <select style={fc} value={form.unit_id} onChange={e => set({ unit_id: e.target.value })}>
            <option value="">— select unit —</option>
            {unitOptions.map(u => (
              <option key={u.id} value={u.id}>{u.block ? `${u.block}-${u.flat_number}` : u.flat_number}</option>
            ))}
          </select>
        </div>
      )}

      {/* Opening balance */}
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
                <button key={side} onClick={() => set({ opening_balance_type: side })} style={{
                  flex: 1, border: 'none',
                  borderRight: side === 'DEBIT' ? '1px solid #e2e8f0' : 'none',
                  background: form.opening_balance_type === side ? '#2563eb' : '#fff',
                  color: form.opening_balance_type === side ? '#fff' : '#475569',
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                }}>{side === 'DEBIT' ? 'DR' : 'CR'}</button>
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

// ── Section component ─────────────────────────────────────────────────────────
function BPSection({
  category, label, icon, iconBg, iconColor,
  bps, unitOptions, onCreate, onUpdate, onToggle, onDelete,
}: {
  category: BPCategory; label: string; icon: string; iconBg: string; iconColor: string;
  bps: BusinessPartner[];
  unitOptions: { id: string; flat_number: string; block: string | null }[];
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

  const buildBody = (f: BPForm, cat: BPCategory) => ({
    code:             f.code.trim(),
    name:             f.name.trim(),
    bp_category:      cat,
    email:            f.email || null,
    phone:            f.phone || null,
    account_number:   cat === 'BANK'   ? f.account_number || null : null,
    ifsc:             cat === 'BANK'   ? f.ifsc || null : null,
    gstin:            cat === 'VENDOR' ? f.gstin || null : null,
    pan:              cat === 'VENDOR' ? f.pan || null : null,
    unit_id:          cat === 'UNIT'   ? f.unit_id || null : null,
    opening_balance:  f.opening_balance ? parseFloat(f.opening_balance) : null,
    opening_balance_type: f.opening_balance ? f.opening_balance_type : null,
    opening_balance_date: f.opening_balance_date || null,
  });

  const handleAdd = async () => {
    setAddError('');
    if (!addForm.code.trim()) { setAddError('Code is required.'); return; }
    if (!addForm.name.trim()) { setAddError('Name is required.'); return; }
    try { await onCreate(buildBody(addForm, category)); setAddForm(emptyForm()); setShowAdd(false); }
    catch (e: unknown) { setAddError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to save.'); }
  };

  const startEdit = (bp: BusinessPartner) => {
    setEditId(bp.id);
    setEditForm({
      code: bp.code, name: bp.name,
      email: bp.email ?? '', phone: bp.phone ?? '',
      account_number: bp.account_number ?? '', ifsc: bp.ifsc ?? '',
      gstin: bp.gstin ?? '', pan: bp.pan ?? '',
      unit_id: bp.unit_id ?? '',
      opening_balance: bp.opening_balance != null ? String(bp.opening_balance) : '',
      opening_balance_type: bp.opening_balance_type ?? 'DEBIT',
      opening_balance_date: bp.opening_balance_date ? bp.opening_balance_date.slice(0, 10) : '',
    });
    setEditError('');
  };

  const handleSaveEdit = async (bp: BusinessPartner) => {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    try { await onUpdate(bp.id, buildBody(editForm, category)); setEditId(null); }
    catch (e: unknown) { setEditError((e as { data?: { message?: string } })?.data?.message ?? 'Failed to update.'); }
  };

  const formatOB = (bp: BusinessPartner) => {
    if (bp.opening_balance == null) return '—';
    const side = bp.opening_balance_type === 'DEBIT' ? 'DR' : 'CR';
    const color = bp.opening_balance_type === 'DEBIT' ? '#185fa5' : '#a32d2d';
    return <span style={{ color, fontFamily: 'monospace', fontSize: 12.5 }}>₹{Number(bp.opening_balance).toLocaleString('en-IN')} {side}</span>;
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      {/* Header */}
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
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Add {label.toLowerCase().replace('s', '').trim()}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <BPFormPanel
          category={category} title={`New ${label.toLowerCase().slice(0, -1)}`}
          form={addForm} onChange={setAddForm}
          onSave={handleAdd} onCancel={() => setShowAdd(false)}
          isSaving={false} error={addError} unitOptions={unitOptions}
        />
      )}

      {/* Table */}
      {bps.length === 0 && !showAdd ? (
        <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No records yet.</div>
      ) : bps.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Code</th>
              <th style={th}>Name</th>
              {category === 'BANK'   && <><th style={th}>Account no.</th><th style={th}>IFSC</th></>}
              {category === 'VENDOR' && <><th style={th}>GSTIN</th><th style={th}>PAN</th></>}
              {category === 'UNIT'   && <th style={th}>Linked unit</th>}
              <th style={{ ...th, textAlign: 'right' }}>Opening balance</th>
              <th style={th}>As-on date</th>
              <th style={th}>Status</th>
              <th style={th}></th>
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
                      isSaving={false} error={editError} unitOptions={unitOptions}
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
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.gstin ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{bp.pan ?? '—'}</td>
                    </>
                  )}
                  {category === 'UNIT' && (
                    <td style={{ padding: '10px 14px', fontSize: 12.5 }}>
                      {bp.unit ? <span style={{ color: '#2563eb' }}>{bp.unit.block ? `${bp.unit.block}-${bp.unit.flat_number}` : bp.unit.flat_number}</span> : '—'}
                    </td>
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
                      <button style={{ ...btnIcon }} title="Edit" onClick={() => startEdit(bp)}>✎</button>
                      <button style={{ ...btnIcon }} title={bp.is_active ? 'Deactivate' : 'Activate'} onClick={() => onToggle(bp.id)}>{bp.is_active ? '⊗' : '↺'}</button>
                      <button style={{ ...btnIcon, color: '#dc2626' }} title="Delete" onClick={() => setDeleteTarget(bp)}>🗑</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}

      {/* Delete confirm */}
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

const th: React.CSSProperties = { padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' };
const btnIcon: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8', padding: '2px 4px', borderRadius: 4 };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BusinessPartnersPage() {
  const { data, isLoading }      = useListBPMastersQuery({});
  const { data: unitData }       = useListUnitOptionsQuery();
  const [createBP]               = useCreateBPMasterMutation();
  const [updateBP]               = useUpdateBPMasterMutation();
  const [toggleBP]               = useToggleBPMasterMutation();
  const [deleteBP]               = useDeleteBPMasterMutation();

  const allBPs     = data?.data ?? [];
  const unitOptions = (unitData?.data ?? []).map(u => ({ id: u.id, flat_number: u.flat_number, block: u.block }));

  const byCategory = (cat: BPCategory) => allBPs.filter(bp => bp.bp_category === cat);

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Business Partners' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1020 }}>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
          Sub-ledger masters for Banks, Vendors, and Units/Flats. Opening balance here flows into the GL control account balance.
        </div>

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : (
          SECTIONS.map(s => (
            <BPSection
              key={s.category}
              {...s}
              bps={byCategory(s.category)}
              unitOptions={unitOptions}
              onCreate={async (body) => { await createBP(body as Partial<BusinessPartner>).unwrap(); }}
              onUpdate={async (id, body) => { await updateBP({ id, body: body as Partial<BusinessPartner> }).unwrap(); }}
              onToggle={(id) => toggleBP(id)}
              onDelete={(id) => deleteBP(id)}
            />
          ))
        )}
      </div>
    </Layout>
  );
}
