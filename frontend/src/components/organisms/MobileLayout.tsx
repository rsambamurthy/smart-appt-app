import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useMobileConfig } from '../../contexts/MobileConfigContext';

// ── Tab definitions ────────────────────────────────────────────────────────────

interface Tab {
  path: string;
  label: string;
  icon: string;
  featureKey?: 'feature_bills' | 'feature_announcements' | 'feature_complaints' | 'feature_visitors';
  roles?: string[]; // undefined = all roles
}

const ALL_TABS: Tab[] = [
  { path: '/mobile/home',            label: 'Home',      icon: '⌂'  },
  { path: '/dues/my-bills',          label: 'Bills',     icon: '₹',  featureKey: 'feature_bills',         roles: ['RESIDENT'] },
  { path: '/announcements',          label: 'Feed',      icon: '📢', featureKey: 'feature_announcements' },
  { path: '/maintenance',            label: 'Service',   icon: '🔧', featureKey: 'feature_complaints' },
  { path: '/visitors/preapprove',    label: 'Visitors',  icon: '🚪', featureKey: 'feature_visitors',      roles: ['RESIDENT'] },
  { path: '/mobile/more',            label: 'More',      icon: '☰'  },
];

// ── Bottom Tab Bar ─────────────────────────────────────────────────────────────

function BottomTabBar() {
  const config = useMobileConfig();
  const user = useSelector((s: RootState) => s.auth.user);
  const role = user?.role ?? '';

  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab.featureKey && !config[tab.featureKey]) return false;
    if (tab.roles && !tab.roles.includes(role)) return false;
    return true;
  });

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: '#fff', borderTop: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
    }}>
      {visibleTabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '8px 4px 6px',
            textDecoration: 'none', minWidth: 0,
            color: isActive ? 'var(--theme-accent, #0095db)' : '#94a3b8',
            borderTop: isActive ? '2px solid var(--theme-accent, #0095db)' : '2px solid transparent',
            transition: 'color 0.15s',
          })}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 10, marginTop: 2, fontWeight: 500, letterSpacing: '0.01em' }}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export default function MobileLayout() {
  const token = useSelector((s: RootState) => s.auth.access_token);
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--color-bg, #f1f5f9)' }}>
      {/* Scrollable content area — leaves room for the bottom tab bar */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  );
}
