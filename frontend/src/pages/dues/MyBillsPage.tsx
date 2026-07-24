import { useState } from 'react';
import { useSelector } from 'react-redux';
import Layout from '../../components/organisms/Layout';
import { useListMyBillsQuery } from '../../store/api/duesApi';
import { useRazorpay } from '../../hooks/useRazorpay';
import type { RootState } from '../../store';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  UNPAID:  { bg: '#fef2f2', color: '#dc2626', label: 'Unpaid' },
  PARTIAL: { bg: '#fffbeb', color: '#d97706', label: 'Partial' },
  PAID:    { bg: '#f0fdf4', color: '#16a34a', label: 'Paid' },
  WAIVED:  { bg: '#f5f3ff', color: '#7c3aed', label: 'Waived' },
};

interface Bill {
  id: string;
  period_month: number;
  period_year: number;
  base_amount: number;
  penalty: number;
  total_amount: number;
  due_date: string;
  status: string;
  bill_label?: string;
  payments: { amount: number }[];
}

export default function MyBillsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data, isFetching, refetch } = useListMyBillsQuery({});
  const { pay } = useRazorpay();
  const bills = (data?.data ?? []) as Bill[];

  const [payingId, setPayingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePay = async (bill: Bill) => {
    setPayingId(bill.id);
    await pay({
      billId: bill.id,
      userName: user?.name ?? '',
      userPhone: user?.phone ?? '',
      userEmail: user?.email ?? '',
      onSuccess: (paymentId) => {
        showToast('success', `Payment successful! ID: ${paymentId}`);
        refetch();
      },
      onError: (msg) => {
        if (msg !== 'Payment cancelled.') showToast('error', msg);
      },
    });
    setPayingId(null);
  };

  const paidAmount = (b: Bill) => b.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = (b: Bill) => Math.max(0, Number(b.total_amount) - paidAmount(b));

  const unpaid = bills.filter((b) => b.status === 'UNPAID' || b.status === 'PARTIAL');
  const paid   = bills.filter((b) => b.status === 'PAID' || b.status === 'WAIVED');

  const totalDue = unpaid.reduce((s, b) => s + balance(b), 0);

  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          background: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: 10,
          fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          maxWidth: 340,
        }}>
          {toast.type === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      <div style={{ padding: '1.5rem 1.25rem', maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>My Bills</h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Pay your maintenance dues securely via Razorpay.
        </p>

        {/* Outstanding summary */}
        {totalDue > 0 && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
            padding: '0.875rem 1rem', marginBottom: '1.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Outstanding</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>₹{totalDue.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{unpaid.length} bill{unpaid.length !== 1 ? 's' : ''} pending</div>
          </div>
        )}

        {isFetching ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
          </div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
            <div style={{ fontWeight: 600, color: '#374151' }}>All clear!</div>
            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>No bills found for your unit.</div>
          </div>
        ) : (
          <>
            {/* Unpaid / partial bills */}
            {unpaid.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Pending</div>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {unpaid.map((bill) => {
                    const st = STATUS_STYLE[bill.status] ?? STATUS_STYLE['UNPAID'];
                    const bal = balance(bill);
                    const isPaying = payingId === bill.id;
                    const overdue = new Date(bill.due_date) < new Date();
                    return (
                      <div key={bill.id} style={{
                        background: '#fff', borderRadius: 10, padding: '0.875rem 1rem',
                        border: `1px solid ${overdue ? '#fca5a5' : '#e5e7eb'}`,
                        borderLeft: `4px solid ${overdue ? '#dc2626' : '#C4572B'}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                            {bill.bill_label ?? `${MONTHS[bill.period_month - 1]} ${bill.period_year}`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                            Due: {new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {overdue && <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 600 }}>• Overdue</span>}
                          </div>
                          {bill.status === 'PARTIAL' && (
                            <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: 2 }}>
                              Paid ₹{paidAmount(bill).toLocaleString('en-IN')} of ₹{Number(bill.total_amount).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>₹{bal.toLocaleString('en-IN')}</div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: st.bg, color: st.color }}>{st.label}</span>
                          <button
                            onClick={() => handlePay(bill)}
                            disabled={isPaying || payingId !== null}
                            style={{
                              padding: '0.45rem 1rem', background: isPaying ? '#9ca3af' : '#C4572B',
                              color: '#fff', border: 'none', borderRadius: 8,
                              fontWeight: 700, fontSize: '0.8rem', cursor: isPaying ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                            }}
                          >
                            {isPaying ? (
                              <>
                                <span style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                                Processing…
                              </>
                            ) : '💳 Pay Now'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paid / waived bills */}
            {paid.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>History</div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {paid.map((bill) => {
                    const st = STATUS_STYLE[bill.status] ?? STATUS_STYLE['PAID'];
                    return (
                      <div key={bill.id} style={{
                        background: '#f9fafb', borderRadius: 10, padding: '0.75rem 1rem',
                        border: '1px solid #e5e7eb',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        opacity: 0.8,
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                            {bill.bill_label ?? `${MONTHS[bill.period_month - 1]} ${bill.period_year}`}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                            {new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151' }}>₹{Number(bill.total_amount).toLocaleString('en-IN')}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
