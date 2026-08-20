import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListRecurringQuery,
  useCreateRecurringMutation,
  useUpdateRecurringMutation,
  useListProvisionsQuery,
  useListExpenseCategoriesQuery,
  RecurringExpense,
  RecurringExpenseFrequency,
  ProvisionStatus,
} from '../../store/api/expensesApi';
import { useListBPMastersQuery } from '../../store/api/accountingApi';

interface RecForm {
  description: string;
  category: string;
  business_partner_id: string;
  amount: string;
  frequency: RecurringExpenseFrequency;
  next_due_date: string;
  reminder_days: string;
  auto_provision: boolean;
}

const emptyForm = (): RecForm => ({
  description: '', category: '', business_partner_id: '', amount: '', frequency: 'MONTHLY',
  next_due_date: '', reminder_days: '3', auto_provision: false,
});

const FREQUENCY_LABEL: Record<RecurringExpenseFrequency, string> = {
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half-Yearly', ANNUAL: 'Annual',
};

const STATUS_STYLE: Record<ProvisionStatus, { bg: string; fg: string; label: string }> = {
  OPEN:     { bg: '#fffbeb', fg: '#b45309', label: 'Open — awaiting actual bill' },
  SETTLED:  { bg: '#f0fdf4', fg: '#16a34a', label: 'Settled' },
  REVERSED: { bg: '#f1f5f9', fg: '#64748b', label: 'Reversed' },
};

const MONTH_NAME = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function RecurringExpensesPage() {
  const { data, isLoading } = useListRecurringQuery();
  const items = data?.data ?? [];

  const { data: catData } = useListExpenseCategoriesQuery();
  const activeCats = ((catData?.data ?? []) as { name: string; display_name: string; is_active: boolean }[])
    .filter((c) => c.is_active);

  // The one vendor list associations actually maintain — Business Partners
  // (Configuration → Business Partners), category VENDOR. A recurring
  // expense's "vendor" is always picked from here, never entered fresh.
  const { data: bpData } = useListBPMastersQuery({ category: 'VENDOR' });
  const vendors = (bpData?.data ?? []).filter((v) => v.is_active);

  const { data: provData, isLoading: provLoading } = useListProvisionsQuery();
  const provisions = provData?.data ?? [];

  const [createRecurring, { isLoading: isCreating }] = useCreateRecurringMutation();
  const [updateRecurring] = useUpdateRecurringMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RecForm>(emptyForm());
  const [formError, setFormError] = useState('');

  const setF = <K extends keyof RecForm>(key: K, value: RecForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleAdd = async () => {
    setFormError('');
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    if (!form.category) { setFormError('Category is required.'); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setFormError('Enter a positive amount.'); return; }
    if (!form.next_due_date) { setFormError('Next due date is required.'); return; }
    if (form.auto_provision && !form.business_partner_id) {
      setFormError('A vendor is required to turn on month-end accrual — it posts against the vendor\'s Accounts Payable card.');
      return;
    }

    try {
      await createRecurring({
        description: form.description.trim(),
        category: form.category,
        business_partner_id: form.business_partner_id || undefined,
        amount,
        frequency: form.frequency,
        next_due_date: new Date(form.next_due_date).toISOString(),
        reminder_days: parseInt(form.reminder_days, 10) || 0,
        auto_provision: form.frequency === 'MONTHLY' ? form.auto_provision : false,
      }).unwrap();
      setForm(emptyForm());
      setShowAdd(false);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setFormError(err?.data?.message ?? 'Failed to create recurring expense.');
    }
  };

  const toggleActive = async (item: RecurringExpense) => {
    await updateRecurring({ id: item.id, body: { is_active: !item.is_active } }).unwrap();
  };

  const toggleProvision = async (item: RecurringExpense) => {
    if (!item.vendor && !item.auto_provision) return; // guarded by disabled state below
    await updateRecurring({ id: item.id, body: { auto_provision: !item.auto_provision } }).unwrap();
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting', path: '/accounting/journal' }, { label: 'Recurring Expenses' }]} />

      <div style={{ padding: '1.5rem 2rem', maxWidth: 960 }}>

        <div style={{ padding: '0.7rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.85rem', color: '#1d4ed8', marginBottom: '1.25rem' }}>
          Recurring expenses are created as a draft expense (needing approval) on each due date. For a fixed, contracted monthly cost —
          a security agency, an AMC — turn on <strong>month-end accrual</strong> to also book it to <strong>Accounts Payable</strong> against
          that vendor's own ledger card on the last day of the month, even if the formal bill hasn't arrived yet. The accrual is automatically
          reversed once you approve the real expense, so it's never counted twice.
        </div>

        {/* ── Recurring expenses list ─────────────────────────────────────── */}
        <div className="ent-section" style={{ marginBottom: '1.5rem' }}>
          <div className="ent-section-hdr" style={{ justifyContent: 'space-between' }}>
            <span className="ent-section-title">Recurring Expenses ({items.filter((i) => i.is_active).length} active)</span>
            <button className="ent-btn-submit" style={{ padding: '4px 14px', fontSize: '0.8rem' }}
              onClick={() => { setShowAdd(true); setFormError(''); setForm(emptyForm()); }}>
              + Add Recurring Expense
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading…</div>
          ) : (
            <div>
              {items.map((item) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                  opacity: item.is_active ? 1 : 0.5, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.description}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                      {item.category} · ₹{Number(item.amount).toLocaleString()} · {FREQUENCY_LABEL[item.frequency]} · next due {new Date(item.next_due_date).toLocaleDateString()}
                      {item.vendor?.name && <> · {item.vendor.name}</>}
                    </div>
                  </div>

                  {item.frequency === 'MONTHLY' && (
                    <label
                      title={item.vendor ? undefined : 'Link a vendor to this recurring expense to enable month-end accrual'}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-muted)', cursor: item.vendor ? 'pointer' : 'not-allowed' }}
                    >
                      <input type="checkbox" checked={item.auto_provision} disabled={!item.vendor} onChange={() => toggleProvision(item)} />
                      Month-end accrual (Accounts Payable)
                    </label>
                  )}

                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                    background: item.is_active ? '#f0fdf4' : '#f1f5f9',
                    color: item.is_active ? '#16a34a' : '#64748b',
                  }}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>

                  <button
                    title={item.is_active ? 'Deactivate' : 'Activate'}
                    onClick={() => toggleActive(item)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--color-border)', background: '#f9fafb', color: 'var(--color-muted)', fontWeight: 600 }}
                  >
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>No recurring expenses yet.</div>
              )}
            </div>
          )}
        </div>

        {/* ── Add form ─────────────────────────────────────────────────────── */}
        {showAdd && (
          <div className="ent-section" style={{ marginBottom: '1.5rem' }}>
            <div className="ent-section-hdr"><span className="ent-section-title">New Recurring Expense</span></div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="ent-fg">
                  <label className="ent-fl">Description *</label>
                  <input className="ent-fc" type="text" placeholder="e.g. Security Agency Contract" value={form.description}
                    onChange={(e) => setF('description', e.target.value)} />
                </div>
                <div className="ent-fg">
                  <label className="ent-fl">Category *</label>
                  <select className="ent-fc" value={form.category} onChange={(e) => setF('category', e.target.value)}>
                    <option value="">— Select —</option>
                    {activeCats.map((c) => <option key={c.name} value={c.name}>{c.display_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="ent-fg">
                <label className="ent-fl">
                  Vendor {form.auto_provision && '*'}
                  <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> (required for month-end accrual)</span>
                </label>
                <select className="ent-fc" value={form.business_partner_id} onChange={(e) => setF('business_partner_id', e.target.value)}>
                  <option value="">— None —</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>
                  Don't see the vendor you need? <Link to="/accounting/business-partners">Add it under Business Partners</Link> first.
                </div>
              </div>

              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="ent-fg">
                  <label className="ent-fl">Amount (₹) *</label>
                  <input className="ent-fc" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                    onChange={(e) => setF('amount', e.target.value)} />
                </div>
                <div className="ent-fg">
                  <label className="ent-fl">Frequency *</label>
                  <select className="ent-fc" value={form.frequency}
                    onChange={(e) => setF('frequency', e.target.value as RecurringExpenseFrequency)}>
                    {(Object.keys(FREQUENCY_LABEL) as RecurringExpenseFrequency[]).map((f) => (
                      <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="ent-fg">
                  <label className="ent-fl">Next Due Date *</label>
                  <input className="ent-fc" type="date" value={form.next_due_date}
                    onChange={(e) => setF('next_due_date', e.target.value)} />
                </div>
                <div className="ent-fg">
                  <label className="ent-fl">Reminder (days before)</label>
                  <input className="ent-fc" type="number" min="0" max="30" value={form.reminder_days}
                    onChange={(e) => setF('reminder_days', e.target.value)} />
                </div>
              </div>

              {form.frequency === 'MONTHLY' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.auto_provision} onChange={(e) => setF('auto_provision', e.target.checked)} />
                  Accrue this to Accounts Payable at month-end if the real bill hasn't been recorded yet — this is a confirmed,
                  contracted amount owed to the vendor above, not an estimate.
                </label>
              )}

              {formError && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem' }}>{formError}</div>
              )}

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="ent-btn-submit" onClick={handleAdd} disabled={isCreating}>{isCreating ? 'Adding…' : 'Add Recurring Expense'}</button>
                <button className="ent-btn-cancel" onClick={() => { setShowAdd(false); setFormError(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Accruals review ──────────────────────────────────────────────── */}
        <div className="ent-section">
          <div className="ent-section-hdr"><span className="ent-section-title">Month-End Accruals (Accounts Payable)</span></div>
          {provLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading…</div>
          ) : (
            <div>
              {provisions.map((p) => {
                const style = STATUS_STYLE[p.status];
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap',
                  }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.recurring_expense.description}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                        {MONTH_NAME[p.period_month]} {p.period_year} · ₹{Number(p.amount).toLocaleString()}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: style.bg, color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
              {provisions.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>No accruals posted yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
