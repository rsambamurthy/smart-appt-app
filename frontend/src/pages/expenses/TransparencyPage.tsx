import Layout from '../../components/organisms/Layout';
import { useGetTransparencyQuery } from '../../store/api/expensesApi';

export default function TransparencyPage() {
  const { data } = useGetTransparencyQuery();
  const items = (data?.data ?? []) as Record<string, unknown>[];
  return (
    <Layout>
      <div className="page-header"><h1>Expense Transparency</h1></div>
      <div className="card">
        <p style={{ color: 'var(--color-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Category-level expense totals for all residents.</p>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((item) => (
            <div key={item['category'] as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontWeight: 500 }}>{item['category'] as string}</span>
              <span style={{ fontWeight: 700 }}>₹{Number(item['total']).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
