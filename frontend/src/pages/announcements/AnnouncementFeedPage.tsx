import Layout from '../../components/organisms/Layout';
import { useListAnnouncementsQuery, useMarkReadMutation } from '../../store/api/announcementsApi';

const CAT_BADGE: Record<string, string> = { URGENT: 'badge-red', EVENT: 'badge-blue', MAINTENANCE: 'badge-yellow', MEETING: 'badge-blue', GENERAL: 'badge-gray' };

export default function AnnouncementFeedPage() {
  const { data, isFetching } = useListAnnouncementsQuery({});
  const [markRead] = useMarkReadMutation();
  const items = (data?.data ?? []) as Record<string, unknown>[];

  return (
    <Layout>
      <div className="page-header"><h1>Announcements</h1></div>
      {isFetching ? <div className="skeleton" style={{ height: 200 }} /> : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.length === 0 && <div className="card" style={{ color: 'var(--color-muted)', textAlign: 'center' }}>No announcements.</div>}
          {items.map((a) => (
            <div key={a['id'] as string} className="card" onClick={() => markRead(a['id'] as string)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{a['title'] as string}</span>
                <span className={`badge ${CAT_BADGE[a['category'] as string] ?? 'badge-gray'}`}>{a['category'] as string}</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>{a['body'] as string}</p>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                Posted by {(a['poster'] as Record<string, string>)?.name ?? '—'} · {new Date(a['published_at'] as string).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
