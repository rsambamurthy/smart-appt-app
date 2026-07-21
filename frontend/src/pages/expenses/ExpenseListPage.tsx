import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListExpensesQuery,
  useListExpenseCategoriesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useApproveExpenseMutation,
} from '../../store/api/expensesApi';

const PAYMENT_MODES = ['CASH', 'CHEQUE', 'ONLINE', 'UPI'] as const;

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Pending',  bg: '#fffbeb', color: '#d97706' },
  APPROVED:         { label: 'Approved', bg: '#f0fdf4', color: '#16a34a' },
  REJECTED:         { label: 'Rejected', bg: '#fef2f2', color: '#dc2626' },
  RECORDED:         { label: 'Recorded', bg: '#eff6ff', color: '#2563eb' },
};

interface Category { id: string; name: string; display_name: string; color: string; is_active: boolean }
interface Expense {
  id: string; expense_date: string; category: string;
  vendor?: { name: string }; vendor_name?: string;
  amount: number; payment_mode: string; description?: string;
  status: string; creator?: { name: string };
}
type FormMode = 'create' | 'edit';
interface ExpenseForm {
  expense_date: string; category: string; vendor_name: string;
  amount: string; payment_mode: typeof PAYMENT_MODES[number]; description: string;
}
const emptyForm = (): ExpenseForm => ({
  expense_date: new Date().toISOString().slice(0, 10),
  category: '', vendor_name: '', amount: '', payment_mode: 'CASH', description: '',
});

export default function ExpenseListPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const isTreasurer = user?.role === 'TREASURER' || user?.role === 'SUPER_USER';
  const isCommittee = user?.role === 'COMMITTEE' || user?.role === 'SUPER_USER';

  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  const { data: catData } = useListExpenseCategoriesQuery();
  const categories = (catData?.data ?? []) as Category[];
  const activeCats = categories.filter((c) => c.is_active);

  const { data: expData, isLoading } = useListExpensesQuery({
    category: filterCategory || undefined,
    status: filterStatus || undefined,
    date_from: filterDateFrom ? new Date(filterDateFrom).toISOString() : undefined,
    date_to: filterDateTo ? new Date(filterDateTo + 'T23:59:59').toISOString() : undefined,
    limit: 100,
  });
  const expenses = (expData?.data ?? []) as Expense[];

  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();
  const [approveExpense] = useApproveExpenseMutation();

  const [panelMode, setPanelMode] = useState<FormMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [approveTarget, setApproveTarget] = useState<{ expense: Expense; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [approveNote, setApproveNote] = useState('');

  const filtered = expenses.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.category.toLowerCase().includes(q) ||
      (e.vendor?.name ?? e.vendor_name ?? '').toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q)
    );
  });

  const getCat = (name: string) => categories.find((x) => x.name === name) ?? { display_name: name, color: '#9ca3af' };

  const openCreate = () => {
    setForm({ ...emptyForm(), category: activeCats[0]?.name ?? '' });
    setEditingId(null); setFormError(''); setPanelMode('create');
  };
  const openEdit = (e: Expense) => {
    setForm({
      expense_date: e.expense_date.slice(0, 10), category: e.category,
      vendor_name: e.vendor?.name ?? e.vendor_name ?? '',
      amount: String(e.amount),
      payment_mode: e.payment_mode as typeof PAYMENT_MODES[number],
      description: e.description ?? '',
    });
    setEditingId(e.id); setFormError(''); setPanelMode('edit');
  };
  const closePanel = () => { setPanelMode(null); setEditingId(null); setFormError(''); };
  const setF = (k: keyof ExpenseForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setFormError('');
    if (!form.expense_date || !form.category || !form.amount || parseFloat(form.amount) <= 0) {
      setFormError('Date, category, and a positive amount are required.'); return;
    }
    const body = {
      expense_date: new Date(form.expense_date).toISOString(), category: form.category,
      vendor_name: form.vendor_name || undefined, amount: parseFloat(form.amount),
      payment_mode: form.payment_mode, description: form.description || undefined,
    };
    try {
      if (panelMode === 'create') await createExpense(body).unwrap();
      else if (editingId) await updateExpense({ id: editingId, body }).unwrap();
      closePanel();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setFormError(err?.data?.message ?? 'Failed to save expense.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteExpense(deleteTarget.id).unwrap();
    setDeleteTarget(null);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    await approveExpense({ id: approveTarget.expense.id, body: { decision: approveTarget.decision, note: approveNote } }).unwrap();
    setApproveTarget(null); setApproveNote('');
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Expenses', to: '/expenses' }, { label: 'Expense List' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* Toolbar */}
        <div className="ent-section" style={{ marginBottom: '1.25rem' }}>
          <div className="ent-toolbar" style={{ padding: '0.75rem 1.25rem', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input className="ent-fc" style={{ flex: '1 1 160px' }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="ent-fc" style={{ width: 160 }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {activeCats.map((c) => <option key={c.name} value={c.name}>{c.display_name}</option>)}
            </select>
            <select className="ent-fc" style={{ width: 120 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {Object.entries(STATUS_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input className="ent-fc" type="date" style={{ width: 135 }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} title="From" />
            <input className="ent-fc" type="date" style={{ width: 135 }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} title="To" />
            {(filterCategory || filterStatus || filterDateFrom || filterDateTo || search) && (
              <button onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); }}
                style={{ padding: '0 10px', height: 30, border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer' }}>
                ✕ Clear
              </button>
            )}
            {isTreasurer && (
              <button className="ent-btn-submit" style={{ marginLeft: 'auto' }} onClick={openCreate}>+ Add Expense</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {isLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
              No expenses found.{isTreasurer && ' Click "+ Add Expense" to record one.'}
            </div>
          ) : (
            <div className="ent-page-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Category</th><th>Vendor / Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th><th>Mode</th>
                    <th>Status</th><th>Added By</th><th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const cat = getCat(e.category);
                    const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE['RECORDED'];
                    const canEdit = isTreasurer && (e.status === 'RECORDED' || e.status === 'PENDING_APPROVAL');
                    const canDelete = isTreasurer && e.status !== 'APPROVED';
                    const canApprove = isCommittee && e.status === 'PENDING_APPROVAL';
                    return (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                          {new Date(e.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px',
                            borderRadius: 4, fontSize: '0.78rem', fontWeight: 600,
                            background: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44`,
                          }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
                            {cat.display_name}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{e.vendor?.name ?? e.vendor_name ?? '—'}</div>
                          {e.description && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{e.description}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(e.amount).toLocaleString()}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{e.payment_mode}</td>
                        <td>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600, background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{e.creator?.name ?? '—'}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {canEdit && <button className="ent-ia ent-ia-edit" title="Edit" onClick={() => openEdit(e)}>✎</button>}
                          {canDelete && <button className="ent-ia ent-ia-del" title="Delete" onClick={() => setDeleteTarget(e)}>🗑</button>}
                          {canApprove && (
                            <>
                              <button onClick={() => setApproveTarget({ expense: e, decision: 'APPROVED' })}
                                style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', cursor: 'pointer', fontWeight: 600, marginRight: 3 }}>
                                ✓ Approve
                              </button>
                              <button onClick={() => setApproveTarget({ expense: e, decision: 'REJECTED' })}
                                style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 600 }}>
                                ✕ Reject
                              </button>
                            </>
                          )}
                          {!canEdit && !canDelete && !canApprove && <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Panel */}
      {panelMode && (
        <>
          <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 201, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', background: 'var(--theme-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700 }}>{panelMode === 'create' ? 'Add Expense' : 'Edit Expense'}</div>
              <button onClick={closePanel} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="ent-fg">
                <label className="ent-fl">Expense Date *</label>
                <input className="ent-fc" type="date" value={form.expense_date} onChange={(e) => setF('expense_date', e.target.value)} />
              </div>
              <div className="ent-fg">
                <label className="ent-fl">Category *</label>
                <select className="ent-fc" value={form.category} onChange={(e) => setF('category', e.target.value)}>
                  <option value="">— Select —</option>
                  {activeCats.map((c) => <option key={c.name} value={c.name}>{c.display_name}</option>)}
                </select>
              </div>
              <div className="ent-fg">
                <label className="ent-fl">Vendor / Payee</label>
                <input className="ent-fc" type="text" placeholder="e.g. BESCOM, Ramesh Cleaning" value={form.vendor_name} onChange={(e) => setF('vendor_name', e.target.value)} />
              </div>
              <div className="ent-fg">
                <label className="ent-fl">Amount (₹) *</label>
                <input className="ent-fc" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setF('amount', e.target.value)} />
              </div>
              <div className="ent-fg">
                <label className="ent-fl">Payment Mode *</label>
                <select className="ent-fc" value={form.payment_mode} onChange={(e) => setF('payment_mode', e.target.value as typeof PAYMENT_MODES[number])}>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="ent-fg">
                <label className="ent-fl">Description / Notes</label>
                <textarea style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: '12px', resize: 'vertical', minHeight: 64, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Optional…" value={form.description} onChange={(e) => setF('description', e.target.value)} />
              </div>
              {formError && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem' }}>{formError}</div>
              )}
              <button className="ent-btn-submit" style={{ width: '100%' }} onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Saving…' : panelMode === 'create' ? 'Add Expense' : 'Save Changes'}
              </button>
              <button className="ent-btn-cancel" style={{ width: '100%' }} onClick={closePanel}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Delete Expense?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1.25rem' }}>
              {getCat(deleteTarget.category).display_name} — ₹{Number(deleteTarget.amount).toLocaleString()}<br />
              {deleteTarget.vendor?.name ?? deleteTarget.vendor_name ?? ''}<br />
              <span style={{ color: '#dc2626', fontWeight: 600 }}>This cannot be undone.</span>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={handleDelete}>Delete</button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Approve Confirm */}
      {approveTarget && (
        <>
          <div onClick={() => setApproveTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
              {approveTarget.decision === 'APPROVED' ? '✓ Approve' : '✕ Reject'} Expense?
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              {getCat(approveTarget.expense.category).display_name} — ₹{Number(approveTarget.expense.amount).toLocaleString()}
            </div>
            <div className="ent-fg" style={{ marginBottom: '1.25rem' }}>
              <label className="ent-fl">Note (optional)</label>
              <input className="ent-fc" type="text" placeholder="Reason…" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ flex: 1, background: approveTarget.decision === 'APPROVED' ? '#16a34a' : '#dc2626' }} onClick={handleApprove}>
                {approveTarget.decision === 'APPROVED' ? 'Approve' : 'Reject'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setApproveTarget(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
