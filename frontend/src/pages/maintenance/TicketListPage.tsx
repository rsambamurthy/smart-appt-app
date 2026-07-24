import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import { IS_NATIVE } from '../../hooks/usePlatform';
import { isResidentRole } from '../../constants/roles';
import { useListTicketsQuery, useListMyTicketsQuery } from '../../store/api/maintenanceApi';

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'badge-blue', ACKNOWLEDGED: 'badge-yellow', IN_PROGRESS: 'badge-yellow',
  RESOLVED: 'badge-green', CLOSED: 'badge-gray',
};

const PRIORITY_BADGE: Record<string, string> = {
  EMERGENCY: 'badge-red', HIGH: 'badge-red', MEDIUM: 'badge-yellow', LOW: 'badge-gray',
};

export default function TicketListPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  // MANAGER/COMMITTEE/TREASURER are also residents — they see their own tickets and can raise requests
  const isResident = isResidentRole(user?.role);
  // On mobile all roles use the resident view; on web resident-equivalent roles do too
  const useMyView = IS_NATIVE || isResident;
  const [status, setStatus] = useState('');

  const { data: managerData, isFetching: mFetching } = useListTicketsQuery({ status: status || undefined }, { skip: useMyView });
  const { data: myData, isFetching: rFetching } = useListMyTicketsQuery({}, { skip: !useMyView });
  const tickets = ((useMyView ? myData : managerData)?.data ?? []) as Record<string, unknown>[];
  const loading = mFetching || rFetching;

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Maintenance Requests</h1>
        {/* All roles can raise a maintenance request on mobile; web restricts to resident */}
        {(IS_NATIVE || isResident) && <Link to="/maintenance/new"><button className="btn-primary">+ Raise Request</button></Link>}
      </div>

      {/* Status filter only on web for managers */}
      {!useMyView && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['', 'SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
            <button key={s} className={status === s ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatus(s)} style={{ fontSize: '0.75rem' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {tickets.length === 0 && <div className="card" style={{ color: 'var(--color-muted)', textAlign: 'center' }}>No tickets found.</div>}
          {tickets.map((t) => (
            <Link key={t['id'] as string} to={`/maintenance/${t['id'] as string}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{t['title'] as string}</div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                    {t['category'] as string} · {(t['unit'] as Record<string, string>)?.flat_number ?? '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <span className={`badge ${PRIORITY_BADGE[t['priority'] as string] ?? 'badge-gray'}`}>{t['priority'] as string}</span>
                  <span className={`badge ${STATUS_BADGE[t['status'] as string] ?? 'badge-gray'}`}>{t['status'] as string}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
