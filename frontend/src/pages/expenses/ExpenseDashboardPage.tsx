import Layout from '../../components/organisms/Layout';
import { useGetExpenseDashboardQuery } from '../../store/api/expensesApi';

export default function ExpenseDashboardPage() {
  const { data } = useGetExpenseDashboardQuery();
  const categories = ((data?.data as Record<string, unknown>)?.['categories'] ?? []) as Record<string, unknown>[];
  return (
    <Layout>
      <div className="page-header"><h1>Expense Dashboard</h1></div>
      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Actuals vs Budget (Current Financial Year)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead><tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Category</th>
            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Budget</th>
            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Spent</th>
            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Surplus</th>
          </tr></thead>
          <tbody>{categories.map((c) => (
            <tr key={c['category'] as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '0.5rem' }}>{c['category'] as string}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(c['budget']).toLocaleString()}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(c['spent']).toLocaleString()}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', color: Number(c['surplus']) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>₹{Number(c['surplus']).toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Layout>
  );
}
