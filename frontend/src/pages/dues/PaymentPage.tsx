import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import { useInitiatePaymentMutation } from '../../store/api/duesApi';
import { useEffect } from 'react';

export default function PaymentPage() {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const [initiate, { data, isLoading }] = useInitiatePaymentMutation();

  useEffect(() => {
    if (billId) initiate({ bill_id: billId });
  }, [billId]);

  useEffect(() => {
    if (!data) return;
    const d = data.data;
    const rzp = new (window as unknown as { Razorpay: new (opts: object) => { open(): void } }).Razorpay({
      key: d.key_id,
      amount: d.amount * 100,
      currency: 'INR',
      name: 'SmartAppt',
      description: 'Monthly Maintenance Dues',
      order_id: d.order_id,
      handler: () => navigate('/dues/my-bills'),
    });
    rzp.open();
  }, [data]);

  return (
    <Layout>
      <div className="page-header"><h1>Payment</h1></div>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        {isLoading ? <p>Initialising payment...</p> : <p>Opening Razorpay checkout...</p>}
      </div>
    </Layout>
  );
}
