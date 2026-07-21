import Layout from '../../components/organisms/Layout';
import { useGetGateLogQuery } from '../../store/api/visitorsApi';

const STATUS_BADGE: Record<string, string> = { PENDING: 'badge-yellow', APPROVED: 'badge-green', DENIED: 'badge-red', ENTERED: 'badge-blue', EXITED: 'badge-gray' };

export default function VisitorLogPage() {
  const { data, isFetching } = useGetGateLogQuery({});
  const logs = (data?.data ?? []) as Record<string, unknown>[];

  return (
    <Layout>
      <div className="page-header"><h1>Gate Log</h1></div>
      {isFetching ? <div className="skeleton" style={{ height: 200 }} /> : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {logs.map((v) => (
            <div key={v['id'] as string} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{v['visitor_name'] as string}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  {(v['unit'] as Record<string, string>)?.flat_number} · {v['purpose'] as string ?? '—'} · {v['visit_type'] as string}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{new Date(v['created_at'] as string).toLocaleString()}</span>
                <span className={`badge ${STATUS_BADGE[v['status'] as string] ?? 'badge-gray'}`}>{v['status'] as string}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
