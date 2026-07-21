import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../store';
import Layout from '../components/organisms/Layout';
import { useGetDashboardQuery } from '../store/api/maintenanceApi';
import { useGetDuesDashboardQuery } from '../store/api/duesApi';

export default function DashboardPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const isManager = user?.role === 'MANAGER';
  const isTreasurer = user?.role === 'TREASURER' || user?.role === 'COMMITTEE';
  const isResident = user?.role === 'RESIDENT';

  const { data: maintDash } = useGetDashboardQuery(undefined, { skip: !isManager });
  const { data: duesDash } = useGetDuesDashboardQuery(undefined, { skip: !isTreasurer });

  const md = maintDash?.data as Record<string, unknown> | undefined;
  const dd = duesDash?.data as Record<string, unknown> | undefined;

  return (
    <Layout>
      <div className="page-header">
        <h1>Welcome, {user?.name}</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{user?.role} Dashboard</p>
        {user?.association_name && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            marginTop: '0.5rem', padding: '4px 12px',
            background: 'var(--color-primary-light, #eff6ff)',
            border: '1px solid var(--color-border)',
            borderRadius: 20, fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 600,
          }}>
            🏢 {user.association_name}
          </div>
        )}
      </div>

      {isResident && (
        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <Link to="/maintenance/new" className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔧</div>
            <div style={{ fontWeight: 600 }}>Raise Maintenance Request</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Report an issue in your flat or common area</div>
          </Link>
          <Link to="/dues/my-bills" className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💳</div>
            <div style={{ fontWeight: 600 }}>Pay Monthly Dues</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>View and pay pending maintenance bills</div>
          </Link>
          <Link to="/visitors/preapprove" className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🚪</div>
            <div style={{ fontWeight: 600 }}>Pre-approve Visitor</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Generate QR for expected visitors</div>
          </Link>
          <Link to="/announcements" className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📢</div>
            <div style={{ fontWeight: 600 }}>Announcements</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Community updates and notices</div>
          </Link>
        </div>
      )}

      {isManager && md && (
        <>
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="value">{String((md['sla_breaches'] as number) ?? 0)}</div>
              <div className="label">SLA Breaches</div>
            </div>
            <div className="stat-card">
              <div className="value">{String((md['avg_resolution_hours'] as number | null | undefined)?.toFixed(1) ?? '—')}</div>
              <div className="label">Avg. Resolution (hrs)</div>
            </div>
            <div className="stat-card">
              <Link to="/maintenance" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="value">→</div>
                <div className="label">View All Tickets</div>
              </Link>
            </div>
          </div>
        </>
      )}

      {isTreasurer && dd && (
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="value">₹{Number((dd['total_outstanding'] as number) ?? 0).toLocaleString()}</div>
            <div className="label">Total Outstanding</div>
          </div>
          <div className="stat-card">
            <div className="value">₹{Number((dd['monthly_collected'] as number) ?? 0).toLocaleString()}</div>
            <div className="label">Collected This Month</div>
          </div>
          <div className="stat-card">
            <Link to="/dues/arrears" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="value">→</div>
              <div className="label">View Arrears</div>
            </Link>
          </div>
        </div>
      )}
    </Layout>
  );
}
