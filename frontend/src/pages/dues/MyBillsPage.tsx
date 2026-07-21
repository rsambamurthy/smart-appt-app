import { Link } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import { useListMyBillsQuery } from '../../store/api/duesApi';

const STATUS_BADGE: Record<string, string> = { UNPAID: 'badge-red', PARTIAL: 'badge-yellow', PAID: 'badge-green', WAIVED: 'badge-gray' };

export default function MyBillsPage() {
  const { data, isFetching } = useListMyBillsQuery({});
  const bills = (data?.data ?? []) as Record<string, unknown>[];

  return (
    <Layout>
      <div className="page-header"><h1>My Bills</h1></div>
      {isFetching ? <div className="skeleton" style={{ height: 200 }} /> : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {bills.length === 0 && <div className="card" style={{ color: 'var(--color-muted)', textAlign: 'center' }}>No bills found.</div>}
          {bills.map((b) => (
            <div key={b['id'] as string} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(b['period_month'] as number) - 1]} {b['period_year'] as number}</div>
                <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Due: {new Date(b['due_date'] as string).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{Number(b['total_amount']).toLocaleString()}</span>
                <span className={`badge ${STATUS_BADGE[b['status'] as string] ?? 'badge-gray'}`}>{b['status'] as string}</span>
                {b['status'] !== 'PAID' && b['status'] !== 'WAIVED' && (
                  <Link to={`/dues/pay/${b['id'] as string}`}><button className="btn-primary" style={{ fontSize: '0.75rem' }}>Pay Now</button></Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
