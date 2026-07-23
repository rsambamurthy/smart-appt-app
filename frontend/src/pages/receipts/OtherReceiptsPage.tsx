import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useListReceiptsQuery, useCreateReceiptMutation, useDeleteReceiptMutation } from '../../store/api/receiptsApi';

const CATEGORIES = ['Interest', 'Parking', 'Event Fee', 'Donation', 'Rental', 'Other'] as const;
const PAYMENT_MODES = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE'] as const;

interface Receipt {
  id: string;
  receipt_date: string;
  amount: string | number;
  category: string;
  description?: string;
  received_from?: string;
  payment_mode: string;
  created_at: string;
}

interface FormState {
  receipt_date: string;
  amount: string;
  category: string;
  description: string;
  received_from: string;
  payment_mode: string;
}

const emptyForm = (): FormState => ({
  receipt_date: new Date().toISOString().slice(0, 10),
  amount: '',
  category: 'Other',
  description: '',
  received_from: '',
  payment_mode: 'CASH',
});

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash', CHEQUE: 'Cheque', BANK_TRANSFER: 'Bank Transfer', ONLINE: 'Online / UPI',
};

export default function OtherReceiptsPage() {
  const { data, isLoading } = useListReceiptsQuery();
  const receipts = (data?.data ?? []) as Receipt[];

  const [createReceipt] = useCreateReceiptMutation();
  const [deleteReceipt] = useDeleteReceiptMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const setF = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const totalAmount = receipts.reduce((s, r) => s + Number(r.amount), 0);

  const handleSave = async () => {
    if (!form.receipt_date) { setFormError('Date is required.'); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError('Valid amount is required.'); return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createReceipt({
        receipt_date:  form.receipt_date,
        amount:        parseFloat(form.amount),
        category:      form.category,
        description:   form.description.trim() || undefined,
        received_from: form.received_from.trim() || undefined,
        payment_mode:  form.payment_mode,
      }).unwrap();
      setShowForm(false);
      setForm(emptyForm());
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; title?: string } };
      setFormError(err?.data?.detail ?? err?.data?.title ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteReceipt(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; title?: string } };
      setDeleteError(err?.data?.detail ?? err?.data?.title ?? 'Delete failed.');
    } finally { setDeleting(false); }
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: 4,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues & Payments', path: '/dues' }, { label: 'Other Receipts' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* Summary bar */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Records',       value: receipts.length,                        color: '#1e3a5f' },
            { label: 'Total Amount',        value: `₹${totalAmount.toLocaleString('en-IN')}`, color: '#16a34a' },
          ].map((s) => (
            <div key={s.label} className="ent-section" style={{ flex: 1, padding: '1rem 1.25rem', margin: 0 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">Other Receipts</span>
            <button
              className="ent-btn-submit"
              style={{ padding: '5px 16px', fontSize: '0.82rem' }}
              onClick={() => { setForm(emptyForm()); setFormError(''); setShowForm(true); }}
            >
              + Add Receipt
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
          ) : (
            <div className="ent-page-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Received From</th>
                    <th>Description</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                        {fmtDate(r.receipt_date)}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>
                          {r.category}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{r.received_from ?? '—'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-muted)', maxWidth: 220 }}>{r.description ?? '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{MODE_LABELS[r.payment_mode] ?? r.payment_mode}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#16a34a' }}>
                        ₹{Number(r.amount).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="ent-ia ent-ia-del"
                          title="Delete"
                          onClick={() => { setDeleteTarget(r); setDeleteError(''); }}
                        >🗑</button>
                      </td>
                    </tr>
                  ))}
                  {receipts.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                        No receipts yet. Click "Add Receipt" to record one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Receipt modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.75rem', width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>Add Other Receipt</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input style={inputStyle} type="date" value={form.receipt_date} onChange={setF('receipt_date')} />
                </div>
                <div>
                  <label style={labelStyle}>Amount (₹) *</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={setF('amount')} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select style={inputStyle} value={form.category} onChange={setF('category')}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Payment Mode *</label>
                  <select style={inputStyle} value={form.payment_mode} onChange={setF('payment_mode')}>
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Received From</label>
                <input style={inputStyle} placeholder="e.g. HDFC Bank, Unit 12A, XYZ Vendor" value={form.received_from} onChange={setF('received_from')} />
              </div>
              <div>
                <label style={labelStyle}>Description / Remarks</label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                  placeholder="Optional notes…"
                  value={form.description}
                  onChange={setF('description')}
                />
              </div>
            </div>

            {formError && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="ent-btn-submit" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Add Receipt'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Delete Receipt?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              ₹{Number(deleteTarget.amount).toLocaleString('en-IN')} — {deleteTarget.category} on {fmtDate(deleteTarget.receipt_date)} will be permanently removed.
            </div>
            {deleteError && (
              <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
