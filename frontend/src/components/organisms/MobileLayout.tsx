import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useMobileConfig } from '../../contexts/MobileConfigContext';
import AssistantLauncher from './AssistantLauncher';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// ── Tab definitions ────────────────────────────────────────────────────────────

interface Tab {
  path: string;
  label: string;
  icon: string;
  featureKey?: 'feature_bills' | 'feature_announcements' | 'feature_complaints' | 'feature_visitors';
  /**
   * The menu item this tab represents. A tab whose item the role cannot see is
   * not drawn — which is how a gate guard stops getting a Bills tab. The
   * association-wide feature flag still applies on top: it turns a feature off
   * for everyone, while the menu decides who among them sees it.
   */
  itemId?: string;
}

const ALL_TABS: Tab[] = [
  { path: '/mobile/home',         label: 'Home',     icon: '⌂'  },
  { path: '/mobile/bills',        label: 'Bills',    icon: '₹',  featureKey: 'feature_bills',         itemId: 'dues_my_bills'      },
  { path: '/announcements',       label: 'Feed',     icon: '📢', featureKey: 'feature_announcements', itemId: 'announcements_feed' },
  { path: '/maintenance',         label: 'Service',  icon: '🔧', featureKey: 'feature_complaints',    itemId: 'maintenance_list'   },
  { path: '/mobile/visitors',     label: 'Visitors', icon: '🚪', featureKey: 'feature_visitors',      itemId: 'visitors_preapprove'},
  { path: '/mobile/more',         label: 'More',     icon: '☰'  },
];

// ── Bottom Tab Bar ─────────────────────────────────────────────────────────────

function BottomTabBar() {
  const config = useMobileConfig();

  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab.featureKey && !config[tab.featureKey]) return false;
    if (tab.itemId && !config.can(tab.itemId)) return false;
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
  // Registers this device for push once signed in. Kept above the early
  // return below so it still runs on the render where `token` first becomes
  // truthy, rather than being skipped by the redirect on that same pass.
  usePushNotifications();
  // Same reasoning applies to the config read that drives the watermark
  // below: called unconditionally, before the early return, so hook order
  // never depends on whether a token happens to be present yet.
  const config = useMobileConfig();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--color-bg, #f1f5f9)' }}>
      {/* Watermark — a single copy of the association's logo, scaled to
          cover the full screen, behind everything. Replaces the small logo
          that used to sit at the top of the Home screen only; this shows on
          every mobile screen instead. `cover` scales it up to fill edge to
          edge (cropping whatever overflows the screen's aspect ratio, same
          as any full-bleed background image) rather than repeating it as a
          tiled pattern. Sits behind the scroll area (z-index 0 vs 1) and is
          unclickable, so it never intercepts a tap. Individual mobile pages
          that used to paint their own opaque background (Home, More,
          Visitors, Chat) were changed to transparent so this shows through
          — everything else already had no opaque root background and
          needed no change. */}
      {config.logo_url && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: `url(${config.logo_url})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.14,
        }} />
      )}
      {/* Scrollable content area — leaves room for the bottom tab bar */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        <Outlet />
      </div>
      {/* Sits above the tab bar rather than behind it. */}
      <div style={{ position: 'relative', zIndex: 900 }}>
        <AssistantLauncher bottomOffset={84} />
      </div>
      <BottomTabBar />
    </div>
  );
}
