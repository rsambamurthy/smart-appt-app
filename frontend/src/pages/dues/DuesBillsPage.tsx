import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListBillsQuery,
  useGenerateBillsMutation,
  useRollbackBillsMutation,
  useRecordOfflinePaymentMutation,
  useGetDuesDashboardQuery,
} from '../../store/api/duesApi';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  UNPAID:  { label: 'Unpaid',   bg: '#fef2f2', color: '#dc2626' },
  PARTIAL: { label: 'Partial',  bg: '#fffbeb', color: '#d97706' },
  PAID:    { label: 'Paid',     bg: '#f0fdf4', color: '#16a34a' },
  WAIVED:  { label: 'Waived',   bg: '#f5f3ff', color: '#7c3aed' },
};

const PAYMENT_MODES = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE'] as const;

interface Bill {
  id: string;
  unit: { flat_number: string; block?: string };
  period_month: number;
  period_year: number;
  base_amount: number;
  penalty: number;
  total_amount: number;
  due_date: string;
  status: string;
  payments: { amount: number; payment_mode: string; payment_date: string }[];
}

interface PaymentForm {
  amount: string;
  mode: typeof PAYMENT_MODES[number];
  reference_no: string;
  payment_date: string;
}

const now = new Date();

export default function DuesBillsPage() {
  // Filters
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Generate / Rollback Dues
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [genYear, setGenYear] = useState(now.getFullYear());
  const [generateBills, { isLoading: isGenerating }] = useGenerateBillsMutation();
  const [rollbackBills, { isLoading: isRollingBack }] = useRollbackBillsMutation();
  const [genResult, setGenResult] = useState<{ created: number; skipped: number } | null>(null);
  const [rollbackResult, setRollbackResult] = useState<{ deleted: number } | null>(null);
  const [genError, setGenError] = useState('');
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  // Bills list
  const { data: billsData, isLoading: isBillsLoading, refetch } = useListBillsQuery({
    month: filterMonth || undefined,
    year: filterYear || undefined,
    status: filterStatus || undefined,
    limit: 100,
  });

  // Dashboard stats
  const { data: dashData } = useGetDuesDashboardQuery();
  const dash = dashData?.data as Record<string, unknown> | undefined;

  // Payment capture panel
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState<PaymentForm>({
    amount: '',
    mode: 'CASH',
    reference_no: '',
    payment_date: new Date().toISOString().slice(0, 10),
  });
  const [recordPayment, { isLoading: isRecording }] = useRecordOfflinePaymentMutation();
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');

  const bills = (billsData?.data ?? []) as Bill[];

  // Client-side search
  const filtered = bills.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.unit.flat_number.toLowerCase().includes(q) ||
      (b.unit.block ?? '').toLowerCase().includes(q)
    );
  });

  // ── Generate Dues ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenError('');
    setGenResult(null);
    setRollbackResult(null);
    try {
      const res = await generateBills({ month: genMonth, year: genYear }).unwrap();
      const d = res.data as { created: number; skipped: number };
      setGenResult(d);
      refetch();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setGenError(err?.data?.message ?? 'Failed to generate dues.');
    }
  };

  // ── Rollback Dues ─────────────────────────────────────────────────────────────
  const handleRollback = async () => {
    setShowRollbackConfirm(false);
    setGenError('');
    setGenResult(null);
    setRollbackResult(null);
    try {
      const res = await rollbackBills({ month: genMonth, year: genYear }).unwrap();
      setRollbackResult({ deleted: res.data.deleted });
      refetch();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setGenError(err?.data?.message ?? 'Rollback failed.');
    }
  };

  // ── Payment capture ──────────────────────────────────────────────────────────
  const openPayPanel = (bill: Bill) => {
    setSelectedBill(bill);
    setPayForm({
      amount: String(Number(bill.total_amount)),
      mode: 'CASH',
      reference_no: '',
      payment_date: new Date().toISOString().slice(0, 10),
    });
    setPayError('');
    setPaySuccess('');
  };

  const closePayPanel = () => {
    setSelectedBill(null);
    setPayError('');
    setPaySuccess('');
  };

  const handleRecordPayment = async () => {
    if (!selectedBill) return;
    setPayError('');
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      setPayError('Please enter a valid amount.');
      return;
    }
    try {
      await recordPayment({
        bill_id: selectedBill.id,
        amount: parseFloat(payForm.amount),
        mode: payForm.mode,
        reference_no: payForm.reference_no || undefined,
        payment_date: new Date(payForm.payment_date).toISOString(),
      }).unwrap();
      setPaySuccess('Payment recorded successfully.');
      refetch();
      setTimeout(closePayPanel, 1500);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setPayError(err?.data?.message ?? 'Failed to record payment.');
    }
  };

  // ── Compute amounts paid for display ────────────────────────────────────────
  const paidAmount = (bill: Bill) =>
    bill.payments.reduce((s, p) => s + Number(p.amount), 0);

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <Layout>
      <PageSubHeader
        crumbs={[
          { label: 'Dues & Payments', to: '/dues' },
          { label: 'Bills & Payments' },
        ]}
      />

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* ── Stats Meta Bar ── */}
        {dash && (
          <div className="ent-meta" style={{ marginBottom: '1.5rem' }}>
            <div>
              <div className="ent-meta-label">Total Outstanding</div>
              <div className="ent-meta-value" style={{ color: '#dc2626', fontWeight: 700, fontSize: '1.1rem' }}>
                ₹{Number(dash['total_outstanding']).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="ent-meta-label">Collected This Month</div>
              <div className="ent-meta-value" style={{ color: '#16a34a', fontWeight: 700, fontSize: '1.1rem' }}>
                ₹{Number(dash['monthly_collected']).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="ent-meta-label">Bills This Period</div>
              <div className="ent-meta-value" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{bills.length}</div>
            </div>
            <div>
              <div className="ent-meta-label">Unpaid</div>
              <div className="ent-meta-value" style={{ color: '#dc2626', fontWeight: 700, fontSize: '1.1rem' }}>
                {bills.filter((b) => b.status === 'UNPAID').length}
              </div>
            </div>
          </div>
        )}

        {/* ── Generate / Rollback Dues ── */}
        <div className="ent-section" style={{ marginBottom: '1.5rem' }}>
          <div className="ent-section-hdr">
            <span className="ent-section-title">Generate Monthly Dues</span>
          </div>
          <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="ent-fg" style={{ marginBottom: 0 }}>
              <label className="ent-fl">Month</label>
              <select className="ent-fc" style={{ width: 140 }} value={genMonth} onChange={(e) => { setGenMonth(parseInt(e.target.value)); setGenResult(null); setRollbackResult(null); setGenError(''); }}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="ent-fg" style={{ marginBottom: 0 }}>
              <label className="ent-fl">Year</label>
              <select className="ent-fc" style={{ width: 100 }} value={genYear} onChange={(e) => { setGenYear(parseInt(e.target.value)); setGenResult(null); setRollbackResult(null); setGenError(''); }}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button
              className="ent-btn-submit"
              onClick={handleGenerate}
              disabled={isGenerating || isRollingBack}
              style={{ marginBottom: 0 }}
            >
              {isGenerating ? 'Generating…' : '⚡ Generate Dues'}
            </button>

            {/* Rollback — only show when not already showing confirm */}
            {!showRollbackConfirm && (
              <button
                onClick={() => { setShowRollbackConfirm(true); setGenResult(null); setRollbackResult(null); setGenError(''); }}
                disabled={isGenerating || isRollingBack}
                style={{
                  padding: '0 14px', height: 30, borderRadius: 4,
                  border: '1px solid #fca5a5', background: '#fef2f2',
                  color: '#dc2626', fontWeight: 600, fontSize: '0.8rem',
                  cursor: 'pointer', marginBottom: 0,
                }}
              >
                ↩ Rollback
              </button>
            )}

            {/* Inline confirm strip */}
            {showRollbackConfirm && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.4rem 0.85rem', borderRadius: 6,
                background: '#fef2f2', border: '1px solid #fca5a5',
                fontSize: '0.85rem',
              }}>
                <span style={{ color: '#991b1b', fontWeight: 600 }}>
                  ⚠ Delete all {MONTHS[genMonth - 1]} {genYear} bills with no payments?
                </span>
                <button
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  style={{ padding: '2px 12px', borderRadius: 4, background: '#dc2626', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {isRollingBack ? 'Rolling back…' : 'Yes, Rollback'}
                </button>
                <button
                  onClick={() => setShowRollbackConfirm(false)}
                  style={{ padding: '2px 10px', borderRadius: 4, background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {genResult && (
              <div style={{ fontSize: '0.875rem', color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac', padding: '0.4rem 0.85rem', borderRadius: 6 }}>
                ✓ {genResult.created} bills created, {genResult.skipped} skipped
              </div>
            )}
            {rollbackResult && (
              <div style={{ fontSize: '0.875rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', padding: '0.4rem 0.85rem', borderRadius: 6 }}>
                ↩ {rollbackResult.deleted} bill{rollbackResult.deleted !== 1 ? 's' : ''} rolled back for {MONTHS[genMonth - 1]} {genYear}
              </div>
            )}
            {genError && (
              <div style={{ fontSize: '0.875rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', padding: '0.4rem 0.85rem', borderRadius: 6 }}>
                {genError}
              </div>
            )}
          </div>
        </div>

        {/* ── Bills Table ── */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">Bills</span>
          </div>

          {/* Toolbar */}
          <div className="ent-toolbar" style={{ padding: '0.75rem 1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 200 }}>
              <input
                className="ent-fc"
                style={{ flex: 1 }}
                placeholder="Search flat / block…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select className="ent-fc" style={{ width: 130 }} value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))}>
                <option value={0}>All Months</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className="ent-fc" style={{ width: 90 }} value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="ent-fc" style={{ width: 110 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
              </select>
            </div>
          </div>

          {isBillsLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading bills…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', color: 'var(--color-muted)', textAlign: 'center', fontSize: '0.875rem' }}>
              No bills found. Generate dues for the selected period using the panel above.
            </div>
          ) : (
            <div className="ent-page-table">
            <table>
              <thead>
                <tr>
                  <th>Flat</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Base Amount</th>
                  <th style={{ textAlign: 'right' }}>Penalty</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill) => {
                  const badge = STATUS_BADGE[bill.status] ?? STATUS_BADGE['UNPAID'];
                  const paid = paidAmount(bill);
                  const canPay = bill.status === 'UNPAID' || bill.status === 'PARTIAL';
                  return (
                    <tr key={bill.id}>
                      <td>
                        <strong>{bill.unit.flat_number}</strong>
                        {bill.unit.block && <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginLeft: 4 }}>• {bill.unit.block}</span>}
                      </td>
                      <td>{MONTHS[bill.period_month - 1]} {bill.period_year}</td>
                      <td style={{ textAlign: 'right' }}>₹{Number(bill.base_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: Number(bill.penalty) > 0 ? '#dc2626' : 'var(--color-muted)' }}>
                        {Number(bill.penalty) > 0 ? `₹${Number(bill.penalty).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(bill.total_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: '#16a34a' }}>
                        {paid > 0 ? `₹${paid.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                        {new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                          fontSize: '0.78rem', fontWeight: 600,
                          background: badge.bg, color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {canPay && (
                          <button
                            onClick={() => openPayPanel(bill)}
                            style={{
                              padding: '3px 10px', fontSize: '0.78rem', borderRadius: 4,
                              background: 'var(--theme-accent-light)', color: 'var(--theme-accent)',
                              border: '1px solid var(--theme-accent)', cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            Record Payment
                          </button>
                        )}
                        {!canPay && <span style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>—</span>}
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

      {/* ── Payment Capture Side Panel ── */}
      {selectedBill && (
        <>
          {/* Backdrop */}
          <div
            onClick={closePayPanel}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200,
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
            background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
            zIndex: 201, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '1rem 1.25rem', background: 'var(--theme-primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Record Payment</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  {selectedBill.unit.flat_number} · {MONTHS[selectedBill.period_month - 1]} {selectedBill.period_year}
                </div>
              </div>
              <button onClick={closePayPanel} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Bill summary */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', background: '#f7f9fd' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <div><span style={{ color: 'var(--color-muted)' }}>Total Due</span><br /><strong>₹{Number(selectedBill.total_amount).toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--color-muted)' }}>Already Paid</span><br /><strong style={{ color: '#16a34a' }}>₹{paidAmount(selectedBill).toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--color-muted)' }}>Balance</span><br /><strong style={{ color: '#dc2626' }}>₹{Math.max(0, Number(selectedBill.total_amount) - paidAmount(selectedBill)).toLocaleString()}</strong></div>
                <div>
                  <span style={{ color: 'var(--color-muted)' }}>Status</span><br />
                  <span style={{
                    display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                    background: STATUS_BADGE[selectedBill.status]?.bg,
                    color: STATUS_BADGE[selectedBill.status]?.color,
                  }}>
                    {STATUS_BADGE[selectedBill.status]?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
              <div className="ent-fg" style={{ marginBottom: '1rem' }}>
                <label className="ent-fl">Amount Received (₹) *</label>
                <input
                  className="ent-fc"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter amount"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>

              <div className="ent-fg" style={{ marginBottom: '1rem' }}>
                <label className="ent-fl">Payment Mode *</label>
                <select
                  className="ent-fc"
                  value={payForm.mode}
                  onChange={(e) => setPayForm((f) => ({ ...f, mode: e.target.value as typeof PAYMENT_MODES[number] }))}
                >
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="ent-fg" style={{ marginBottom: '1rem' }}>
                <label className="ent-fl">Payment Date *</label>
                <input
                  className="ent-fc"
                  type="date"
                  value={payForm.payment_date}
                  onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </div>

              <div className="ent-fg" style={{ marginBottom: '1.25rem' }}>
                <label className="ent-fl">Reference No / Cheque No</label>
                <input
                  className="ent-fc"
                  type="text"
                  placeholder="Optional"
                  value={payForm.reference_no}
                  onChange={(e) => setPayForm((f) => ({ ...f, reference_no: e.target.value }))}
                />
              </div>

              {payError && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {payError}
                </div>
              )}
              {paySuccess && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  ✓ {paySuccess}
                </div>
              )}

              <button
                className="ent-btn-submit"
                style={{ width: '100%' }}
                onClick={handleRecordPayment}
                disabled={isRecording}
              >
                {isRecording ? 'Recording…' : 'Confirm Payment'}
              </button>
              <button
                className="ent-btn-cancel"
                style={{ width: '100%', marginTop: '0.5rem' }}
                onClick={closePayPanel}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
