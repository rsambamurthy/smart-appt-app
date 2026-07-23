import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';

export default function ReportsPage() {
  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Transactions' }, { label: 'Reports' }]} />
      <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
          Reports — Coming Soon
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
          Financial reports will be available in a future update.
        </div>
      </div>
    </Layout>
  );
}
