import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Layout from '../../components/organisms/Layout';
import { useInitiatePaymentMutation, useVerifyPaymentMutation } from '../../store/api/duesApi';
import { updateAccessToken } from '../../features/auth/authSlice';
import type { AppDispatch } from '../../store';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export default function PaymentPage() {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams] = useSearchParams();

  // Present only when this page was opened in a Custom Tab from the native
  // app (see hooks/useRazorpay.ts) — that's a separate browser process with
  // no access to the app's own Redux/session storage, so the access token
  // is handed over once via the URL instead. A normal web visit to this
  // page never has this param and behaves exactly as before.
  const nativeToken = searchParams.get('token');
  const [ready, setReady] = useState(!nativeToken);
  const [status, setStatus] = useState<'opening' | 'success' | 'error'>('opening');
  const [message, setMessage] = useState('');

  const [initiate, { data, isLoading }] = useInitiatePaymentMutation();
  const [verify] = useVerifyPaymentMutation();

  useEffect(() => {
    if (nativeToken) {
      dispatch(updateAccessToken(nativeToken));
      setReady(true);
    }
    // Only ever needs to run once per page load — re-running on every
    // dispatch identity change would just re-set the same token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && billId) initiate({ bill_id: billId });
  }, [ready, billId]);

  useEffect(() => {
    if (!data) return;
    const d = data.data;
    const rzp = new (window as unknown as { Razorpay: new (opts: object) => { open(): void } }).Razorpay({
      key: d.key_id,
      amount: d.amount * 100,
      currency: 'INR',
      name: 'SmartAppt Gold',
      description: 'Maintenance Dues Payment',
      order_id: d.order_id,
      handler: async (response: RazorpayResponse) => {
        try {
          const result = await verify({
            bill_id: billId!,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }).unwrap();
          void result;
          if (nativeToken) {
            setStatus('success');
            setMessage('Payment successful! You can close this tab and return to the app.');
          } else {
            navigate('/dues/my-bills');
          }
        } catch {
          if (nativeToken) {
            setStatus('error');
            setMessage('Payment captured but verification failed. Please contact support before paying again.');
          } else {
            navigate('/dues/my-bills');
          }
        }
      },
      modal: {
        ondismiss: () => {
          if (nativeToken) {
            setStatus('error');
            setMessage('Payment cancelled. You can close this tab and return to the app.');
          } else {
            navigate('/dues/my-bills');
          }
        },
      },
    });
    rzp.open();
  }, [data]);

  const body = (
    <>
      <div className="page-header"><h1>Payment</h1></div>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        {status === 'opening' && <p>{isLoading || !ready ? 'Initialising payment...' : 'Opening Razorpay checkout...'}</p>}
        {status === 'success' && <p style={{ color: '#16a34a', fontWeight: 600 }}>{message}</p>}
        {status === 'error' && <p style={{ color: '#dc2626', fontWeight: 600 }}>{message}</p>}
      </div>
    </>
  );

  // Opened via the native handoff: this is a bare Custom Tab session with no
  // real state.auth.user (see the route comment in App.tsx), so the full
  // app chrome (nav sidebar, account menu) would render mostly empty and
  // isn't useful here anyway — a plain centered card reads more like "one
  // step in a payment," which is what it actually is.
  if (nativeToken) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
        {body}
      </div>
    );
  }

  return <Layout>{body}</Layout>;
}
