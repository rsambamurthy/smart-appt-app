import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListOneTimeDuesQuery,
  useCreateOneTimeDueMutation,
  useUpdateOneTimeDueMutation,
  useDeleteOneTimeDueMutation,
  useGenerateOneTimeDueBillsMutation,
  useDeleteOneTimeDueBillsMutation,
  useCloseOneTimeDueMutation,
} from '../../store/api/duesApi';
import { useListUnitsQuery } from '../../store/api/usersApi';

interface OneTimeDue {
  id: string;
  title: string;
  description?: string;
  charge_type: 'FIXED' | 'RATE_PER_SQFT';
  amount: string;
  due_date: string;
  status: 'DRAFT' | 'BILLS_GENERATED' | 'CLOSED';
  bills_count: number;
  target_unit_ids: string[];
  created_at: string;
}

interface UnitUser { id: string; name: string; is_owner: boolean; }
interface Unit { id: string; flat_number: string; block?: string; users?: UnitUser[]; }

interface DueForm {
  title: string;
  description: string;
  charge_type: 'FIXED' | 'RATE_PER_SQFT';
  amount: string;
  due_date: string;
  target_all: boolean;
  target_unit_ids: string[];
}

const emptyForm = (): DueForm => ({
  title: '', description: '', charge_type: 'FIXED', amount: '',
  due_date: new Date().toISOString().slice(0, 10),
  target_all: true, target_unit_ids: [],
});

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT:           { label: 'Draft',           bg: '#fef9c3', color: '#854d0e' },
  BILLS_GENERATED: { label: 'Bills Generated', bg: '#f0fdf4', color: '#16a34a' },
  CLOSED:          { label: 'Closed',          bg: '#f1f5f9', color: '#64748b' },
};

export default function OneTimeDuesPage() {
  const { data, isLoading } = useListOneTimeDuesQuery();
  const dues = (data?.data ?? []) as OneTimeDue[];

  const { data: unitsData } = useListUnitsQuery();
  const units = (unitsData?.data ?? []) as Unit[];

  const [createOneTimeDue]    = useCreateOneTimeDueMutation();
  const [updateOneTimeDue]    = useUpdateOneTimeDueMutation();
  const [deleteOneTimeDue]    = useDeleteOneTimeDueMutation();
  const [generateBills]       = useGenerateOneTimeDueBillsMutation();
  const [deleteOneTimeDueBills] = useDeleteOneTimeDueBillsMutation();
  const [closeOneTimeDue]     = useCloseOneTimeDueMutation();

  // Create / Edit form state
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<DueForm>(emptyForm());
  const [formError, setFormError]   = useState('');
  const [saving, setSaving]         = useState(false);

  // Generate bills modal
  const [generateTarget, setGenerateTarget] = useState<OneTimeDue | null>(null);
  const [generating, setGenerating]         = useState(false);
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number } | null>(null);
  const [generateError, setGenerateError]   = useState('');

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<OneTimeDue | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState('');

  // Close confirm modal
  const [closeTarget, setCloseTarget] = useState<OneTimeDue | null>(null);

  // Delete bills confirm modal
  const [deleteBillsTarget, setDeleteBillsTarget] = useState<OneTimeDue | null>(null);
  const [deletingBills, setDeletingBills]         = useState(false);
  const [deleteBillsError, setDeleteBillsError]   = useState('');

  const setF = (k: keyof DueForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (d: OneTimeDue) => {
    setEditingId(d.id);
    const ids = d.target_unit_ids ?? [];
    setForm({
      title:           d.title,
      description:     d.description ?? '',
      charge_type:     d.charge_type,
      amount:          d.amount,
      due_date:        d.due_date.slice(0, 10),
      target_all:      ids.length === 0,
      target_unit_ids: ids,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim())   { setFormError('Title is required.'); return; }
    if (!form.amount)         { setFormError('Amount is required.'); return; }
    if (!form.due_date)       { setFormError('Due date is required.'); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setFormError('Amount must be a positive number.'); return; }
    if (!form.target_all && form.target_unit_ids.length === 0) {
      setFormError('Please select at least one unit, or switch to "All Units".'); return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        title:           form.title.trim(),
        description:     form.description.trim() || undefined,
        charge_type:     form.charge_type,
        amount:          amt,
        due_date:        form.due_date,
        target_unit_ids: form.target_all ? [] : form.target_unit_ids,
      };
      if (editingId) {
        await updateOneTimeDue({ id: editingId, body: payload }).unwrap();
      } else {
        await createOneTimeDue(payload).unwrap();
      }
      setShowForm(false);
    } catch (e: unknown) {
      const err = e as { data?: { title?: string; detail?: string } };
      setFormError(err?.data?.detail ?? err?.data?.title ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (!generateTarget) return;
    setGenerating(true);
    setGenerateError('');
    setGenerateResult(null);
    try {
      const res = await generateBills({ id: generateTarget.id, body: {} }).unwrap();
      setGenerateResult(res.data);
    } catch (e: unknown) {
      const err = e as { data?: { title?: string; detail?: string } };
      setGenerateError(err?.data?.detail ?? err?.data?.title ?? 'Failed to generate bills.');
    } finally { setGenerating(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOneTimeDue(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (e: unknown) {
      const err = e as { data?: { title?: string; detail?: string } };
      setDeleteError(err?.data?.detail ?? err?.data?.title ?? 'Delete failed.');
    } finally { setDeleting(false); }
  };

  const handleClose = async () => {
    if (!closeTarget) return;
    try {
      await closeOneTimeDue(closeTarget.id).unwrap();
      setCloseTarget(null);
    } catch { /* ignore */ }
  };

  const handleDeleteBills = async () => {
    if (!deleteBillsTarget) return;
    setDeletingBills(true);
    setDeleteBillsError('');
    try {
      await deleteOneTimeDueBills(deleteBillsTarget.id).unwrap();
      setDeleteBillsTarget(null);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; title?: string } };
      setDeleteBillsError(err?.data?.detail ?? err?.data?.title ?? 'Delete failed.');
    } finally { setDeletingBills(false); }
  };

  const fmtAmount = (d: OneTimeDue) =>
    d.charge_type === 'RATE_PER_SQFT'
      ? `₹${Number(d.amount).toFixed(2)}/sqft`
      : `₹${Number(d.amount).toLocaleString('en-IN')}`;

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem' };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues & Payments', path: '/dues' }, { label: 'One-Time Dues' }]} />
      <div style={{ padding: '1.5rem 2rem' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total',           value: dues.length,                                    color: '#1e3a5f' },
            { label: 'Draft',           value: dues.filter(d => d.status === 'DRAFT').length,           color: '#854d0e' },
            { label: 'Bills Generated', value: dues.filter(d => d.status === 'BILLS_GENERATED').length, color: '#16a34a' },
          ].map((s) => (
            <div key={s.label} className="ent-section" style={{ flex: 1, padding: '1rem 1.25rem', margin: 0 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">One-Time Dues</span>
            <button className="ent-btn-submit" style={{ padding: '5px 16px', fontSize: '0.82rem' }} onClick={openCreate}>
              + New One-Time Due
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
          ) : (
            <div className="ent-page-table">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Charge</th>
                    <th>Due Date</th>
                    <th style={{ textAlign: 'center' }}>Bills</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dues.map((d) => {
                    const sm = STATUS_META[d.status] ?? STATUS_META['DRAFT'];
                    return (
                      <tr key={d.id} style={{ opacity: d.status === 'CLOSED' ? 0.6 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.title}</div>
                          {d.description && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>{d.description}</div>}
                          <div style={{ marginTop: 4 }}>
                            {(d.target_unit_ids ?? []).length === 0 ? (
                              <span style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 3, background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>
                                All Units
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 3, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a' }}>
                                {(d.target_unit_ids ?? []).length} unit{(d.target_unit_ids ?? []).length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {fmtAmount(d)}
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 400 }}>
                            {d.charge_type === 'RATE_PER_SQFT' ? 'Per sq ft' : 'Fixed per unit'}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{fmtDate(d.due_date)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{d.bills_count}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: sm.bg, color: sm.color }}>
                            {sm.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {d.status === 'DRAFT' && (
                            <>
                              <button className="ent-ia ent-ia-edit" title="Edit" onClick={() => openEdit(d)}>✎</button>
                              <button
                                title="Generate Bills for all units"
                                onClick={() => { setGenerateTarget(d); setGenerateResult(null); setGenerateError(''); }}
                                style={{ marginLeft: 4, padding: '3px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}
                              >
                                Generate Bills
                              </button>
                              <button className="ent-ia ent-ia-del" title="Delete" style={{ marginLeft: 4 }} onClick={() => { setDeleteTarget(d); setDeleteError(''); }}>🗑</button>
                            </>
                          )}
                          {d.status === 'BILLS_GENERATED' && (
                            <>
                              <button
                                title="Hard-delete all generated bills (resets to Draft)"
                                onClick={() => { setDeleteBillsTarget(d); setDeleteBillsError(''); }}
                                style={{ marginRight: 4, padding: '3px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}
                              >
                                Delete Bills
                              </button>
                              <button
                                title="Close this one-time due"
                                onClick={() => setCloseTarget(d)}
                                style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--color-border)', background: '#f9fafb', color: 'var(--color-muted)', fontWeight: 600 }}
                              >
                                Close
                              </button>
                            </>
                          )}
                          {d.status === 'CLOSED' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {dues.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                      No one-time dues yet. Click "New One-Time Due" to create one.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.75rem', width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>
              {editingId ? 'Edit One-Time Due' : 'New One-Time Due'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} placeholder="e.g. Building Painting" value={form.title} onChange={setF('title')} />
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                  placeholder="Additional details…"
                  value={form.description}
                  onChange={setF('description')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Charge Type *</label>
                  <select style={inputStyle} value={form.charge_type} onChange={setF('charge_type')}>
                    <option value="FIXED">Fixed per unit</option>
                    <option value="RATE_PER_SQFT">Rate per sq ft</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{form.charge_type === 'RATE_PER_SQFT' ? 'Rate (₹/sqft) *' : 'Amount per unit (₹) *'}</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={setF('amount')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Due Date *</label>
                <input style={inputStyle} type="date" value={form.due_date} onChange={setF('due_date')} />
              </div>

              {/* Unit targeting */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>Target Units</span>
                  {([true, false] as const).map((v) => (
                    <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer', margin: 0, whiteSpace: 'nowrap' }}>
                      <input
                        type="radio"
                        checked={form.target_all === v}
                        onChange={() => setForm((f) => ({ ...f, target_all: v, target_unit_ids: [] }))}
                      />
                      {v ? 'All Units' : 'Specific Units'}
                    </label>
                  ))}
                </div>
                {!form.target_all && (
                  <div style={{ marginTop: '0.5rem', maxHeight: 180, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.25rem 0' }}>
                    {units.length === 0 ? (
                      <div style={{ padding: '0.75rem', color: 'var(--color-muted)', fontSize: '0.8rem' }}>No units found.</div>
                    ) : units.map((u) => {
                      const owner = u.users?.find((x) => x.is_owner) ?? u.users?.[0];
                      const flatLabel = u.block ? `${u.block}-${u.flat_number}` : u.flat_number;
                      const occupantLabel = owner ? owner.name : 'Vacant';
                      return (
                        <label key={u.id} style={{ display: 'grid', gridTemplateColumns: '20px 100px 1fr', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          <input
                            type="checkbox"
                            style={{ margin: 0 }}
                            checked={form.target_unit_ids.includes(u.id)}
                            onChange={(e) => {
                              setForm((f) => ({
                                ...f,
                                target_unit_ids: e.target.checked
                                  ? [...f.target_unit_ids, u.id]
                                  : f.target_unit_ids.filter((x) => x !== u.id),
                              }));
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flatLabel}</span>
                          <span style={{ color: 'var(--color-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{occupantLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {!form.target_all && form.target_unit_ids.length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4 }}>
                    Select at least one unit, or switch to "All Units".
                  </div>
                )}
              </div>
            </div>

            {formError && <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem' }}>{formError}</div>}

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="ent-btn-submit" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Generate Bills modal ────────────────────────────────────────────── */}
      {generateTarget && (
        <>
          <div onClick={() => !generating && setGenerateTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.75rem', width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>Generate Bills</div>

            {!generateResult ? (
              <>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                  This will create a bill for <strong>every unit</strong> in your association for:
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{generateTarget.title}</div>
                  <div style={{ color: 'var(--color-muted)' }}>{fmtAmount(generateTarget)} · Due {fmtDate(generateTarget.due_date)}</div>
                  {generateTarget.description && <div style={{ color: 'var(--color-muted)', marginTop: 4, fontSize: '0.8rem' }}>{generateTarget.description}</div>}
                </div>
                {generateError && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{generateError}</div>}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button className="ent-btn-submit" style={{ flex: 1 }} onClick={handleGenerate} disabled={generating}>
                    {generating ? 'Generating…' : 'Confirm & Generate'}
                  </button>
                  <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setGenerateTarget(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 4 }}>✓</div>
                  <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>Bills Generated!</div>
                  <div style={{ fontSize: '0.875rem', color: '#15803d' }}>
                    {generateResult.created} bill{generateResult.created !== 1 ? 's' : ''} created
                    {generateResult.skipped > 0 && ` · ${generateResult.skipped} unit${generateResult.skipped !== 1 ? 's' : ''} skipped`}
                  </div>
                </div>
                <button className="ent-btn-submit" style={{ width: '100%' }} onClick={() => setGenerateTarget(null)}>Done</button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Delete confirm modal ────────────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Delete One-Time Due?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              <strong>{deleteTarget.title}</strong> will be permanently deleted. This cannot be undone.
            </div>
            {deleteError && <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Close confirm modal ─────────────────────────────────────────────── */}
      {closeTarget && (
        <>
          <div onClick={() => setCloseTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Close One-Time Due?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              <strong>{closeTarget.title}</strong> will be marked as Closed. The generated bills and payments are unaffected.
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ flex: 1 }} onClick={handleClose}>Close Due</button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setCloseTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Bills confirm modal ──────────────────────────────────────── */}
      {deleteBillsTarget && (
        <>
          <div onClick={() => !deletingBills && setDeleteBillsTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Delete Generated Bills?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
              This will <strong>permanently delete all {deleteBillsTarget.bills_count} bills</strong> generated for <strong>{deleteBillsTarget.title}</strong> and reset it back to Draft. This cannot be undone.
            </div>
            <div style={{ padding: '0.6rem 0.75rem', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: '0.82rem', color: '#92400e', marginBottom: '1rem' }}>
              ⚠ Bills with existing payments cannot be deleted. Remove payments first.
            </div>
            {deleteBillsError && (
              <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {deleteBillsError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={handleDeleteBills} disabled={deletingBills}>
                {deletingBills ? 'Deleting…' : 'Delete All Bills'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setDeleteBillsTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
