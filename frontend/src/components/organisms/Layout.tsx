import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { clearCredentials } from '../../features/auth/authSlice';
import { useLogoutMutation } from '../../store/api/authApi';
import { baseApi } from '../../store/api/baseApi';
import { useTheme, PRESETS, type ThemePreset } from '../../contexts/ThemeContext';
import { useGetMenuConfigQuery } from '../../store/api/systemApi';

interface NavItem {
  id: string;
  label: string;
  path: string;
  roles: string[];
  dot: string;
  end?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  roles: string[];
  items: NavItem[];
  landingPath?: string; // if set, group header navigates here
}

// All roles including SUPER_USER (which sees everything)
const ALL_ROLES = ['SUPER_USER', 'MANAGER', 'RESIDENT', 'COMMITTEE', 'TREASURER', 'GATE_STAFF'];

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'config',
    label: 'Configuration',
    icon: '⚙',
    roles: ['SUPER_USER', 'TREASURER', 'MANAGER'],
    items: [
      { id: 'dues_config',          label: 'Fee Configuration',   path: '/dues/config',           roles: ['SUPER_USER', 'TREASURER'],                              dot: '#a855f7', end: true },
      { id: 'razorpay_config',      label: 'Razorpay',            path: '/config/razorpay',       roles: ['SUPER_USER', 'TREASURER'],                              dot: '#3395FF', end: true },
      { id: 'expenses_categories',  label: 'Expense Categories',  path: '/expenses/categories',   roles: ['SUPER_USER', 'TREASURER', 'MANAGER'],                   dot: '#f59e0b', end: true },
      { id: 'admin_users',          label: 'Manage Users',        path: '/admin/users',           roles: ['SUPER_USER', 'MANAGER'],                                dot: '#22c55e', end: true },
      { id: 'admin_units',          label: 'Manage Units',        path: '/admin/units',           roles: ['SUPER_USER', 'MANAGER'],                                dot: '#0095db', end: true },
    ],
  },
  {
    id: 'associations',
    label: 'Associations',
    icon: 'S',
    roles: ['SUPER_USER'],
    items: [
      { id: 'admin_associations', label: 'All Associations', path: '/admin/associations', roles: ['SUPER_USER'], dot: '#f59e0b', end: true },
    ],
  },
  {
    id: 'system',
    label: 'System Settings',
    icon: '🔧',
    roles: ['SUPER_USER'],
    items: [
      { id: 'system_menu_config', label: 'Menu Configuration', path: '/admin/menu-config', roles: ['SUPER_USER'], dot: '#0095db', end: true },
    ],
  },
  {
    id: 'dues',
    label: 'Dues & Payments',
    icon: 'D',
    roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE', 'MANAGER'],
    landingPath: '/dues',
    items: [
      { id: 'dues_bills',    label: 'Bills & Payments', path: '/dues/bills',         roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE', 'MANAGER'], dot: '#0095db', end: true },
      { id: 'dues_one_time', label: 'One-Time Dues',    path: '/dues/one-time-dues', roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE', 'MANAGER'], dot: '#ec4899', end: true },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: 'T',
    roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE', 'MANAGER'],
    landingPath: '/transactions/dashboard',
    items: [
      { id: 'expenses_list',        label: 'Expense', path: '/expenses',            roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE'],             dot: '#f59e0b', end: true },
      { id: 'dues_other_receipts',  label: 'Receipts',      path: '/dues/other-receipts', roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE', 'MANAGER'], dot: '#14b8a6', end: true },
      { id: 'transactions_reports', label: 'Reports',       path: '/transactions/reports',roles: ['SUPER_USER', 'TREASURER', 'COMMITTEE', 'MANAGER'], dot: '#a855f7', end: true },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'A',
    roles: ['SUPER_USER', 'MANAGER', 'TREASURER'],
    landingPath: '/accounting/chart-of-accounts',
    items: [
      { id: 'chart_of_accounts', label: 'Chart of Accounts', path: '/accounting/chart-of-accounts', roles: ['SUPER_USER', 'MANAGER', 'TREASURER'], dot: '#2563eb', end: true },
      { id: 'journal_entries',   label: 'Journal Entries',   path: '/accounting/journal',            roles: ['SUPER_USER', 'MANAGER', 'TREASURER', 'COMMITTEE'], dot: '#7c3aed', end: true },
      { id: 'ledger',            label: 'Ledger',            path: '/accounting/ledger',             roles: ['SUPER_USER', 'MANAGER', 'TREASURER', 'COMMITTEE'], dot: '#16a34a', end: true },
      { id: 'pnl',               label: 'Profit & Loss',     path: '/accounting/pnl',                roles: ['SUPER_USER', 'MANAGER', 'TREASURER', 'COMMITTEE'], dot: '#f59e0b', end: true },
      { id: 'balance_sheet',     label: 'Balance Sheet',     path: '/accounting/balance-sheet',      roles: ['SUPER_USER', 'MANAGER', 'TREASURER', 'COMMITTEE'], dot: '#7c3aed', end: true },
    ],
  },
  {
    id: 'residents',
    label: 'Residents',
    icon: 'R',
    roles: ALL_ROLES,
    items: [
      { id: 'dues_my_bills',        label: 'My Bills',          path: '/dues/my-bills',         roles: ['SUPER_USER', 'RESIDENT'],                                                           dot: '#f59e0b', end: true },
      { id: 'maintenance_list',     label: 'Service Requests',  path: '/maintenance',           roles: ALL_ROLES,                                                                            dot: '#ef4444', end: true },
      { id: 'maintenance_new',      label: 'Raise Request',     path: '/maintenance/new',       roles: ALL_ROLES,                                                                            dot: '#0095db', end: true },
      { id: 'announcements_feed',   label: 'Announcements',     path: '/announcements',         roles: ALL_ROLES,                                                                            dot: '#22c55e', end: true },
      { id: 'expenses_transparency', label: 'Transparency',     path: '/expenses/transparency', roles: ALL_ROLES,                                                                            dot: '#6366f1', end: true },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: '📄',
    roles: ALL_ROLES,
    items: [
      { id: 'announcements_docs', label: 'Documents', path: '/documents', roles: ALL_ROLES, dot: '#0095db', end: true },
    ],
  },
  {
    id: 'visitors',
    label: 'Visitors',
    icon: 'V',
    roles: ['SUPER_USER', 'MANAGER', 'GATE_STAFF', 'RESIDENT'],
    items: [
      { id: 'visitors_log',        label: 'Visitor Log',    path: '/visitors',           roles: ['SUPER_USER', 'MANAGER', 'GATE_STAFF'], dot: '#22c55e', end: true },
      { id: 'visitors_preapprove', label: 'Pre-Approve',    path: '/visitors/preapprove',roles: ['SUPER_USER', 'RESIDENT'],              dot: '#0095db', end: true },
      { id: 'visitors_gate',       label: 'Gate Dashboard', path: '/gate',               roles: ['SUPER_USER', 'GATE_STAFF'],            dot: '#f59e0b', end: true },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [logout] = useLogoutMutation();
  const { preset, setPreset } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? '';
  const { data: menuConfigData } = useGetMenuConfigQuery();
  const menuConfig = menuConfigData?.data;

  // Build visible groups: group-level role gate removed so Super User can grant any item to any role
  const visibleGroups = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (role === 'SUPER_USER') return true;            // SUPER_USER always sees all
        const stored = menuConfig?.[role]?.[i.id];
        if (stored !== undefined) return stored;           // use Super User's config if set
        return i.roles.includes(role);                    // fall back to coded defaults
      }),
    }))
    .filter((g) => g.items.length > 0);

  // Find which group contains the active route
  const activeGroupId = visibleGroups.find((g) =>
    g.items.some(
      (i) => location.pathname === i.path || location.pathname.startsWith(i.path + '/')
    )
  )?.id;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(activeGroupId ? [activeGroupId] : [])
  );

  // Auto-expand the active group when route changes
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => new Set([...prev, activeGroupId]));
    }
  }, [activeGroupId]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    dispatch(baseApi.util.resetApiState()); // clear all cached API data
    dispatch(clearCredentials());
    navigate('/login');
  };

  // Close theme popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Close sidebar when route changes (user tapped a nav link)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="sa-shell">
      {/* ── Header ── */}
      <header className="sa-header">
        {/* Hamburger — mobile only */}
        <button className="sa-hamburger" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle menu">
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="sa-logo">
          <img src="/smartappt-logo.png" alt="SmartAppt" style={{ height: 36, width: 'auto', display: 'block' }} />
        </div>

        <div className="sa-search">
          <svg className="sa-search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input placeholder="Search…" />
        </div>

        {/* Association name — shown for all roles except SUPER_USER */}
        {user?.association_name && user.role !== 'SUPER_USER' && (
          <div className="sa-assoc-chip">
            🏢 {user.association_name}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Theme switcher */}
        <div className="sa-theme-wrap" ref={themeRef}>
          <button
            className="sa-hbtn"
            onClick={() => setThemeOpen((o) => !o)}
            title="Change color theme"
          >
            {/* Palette icon */}
            <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
            </svg>
          </button>
          {themeOpen && (
            <div className="sa-theme-pop">
              <div className="sa-theme-label">Color Theme</div>
              {(Object.keys(PRESETS) as ThemePreset[]).map((p) => (
                <button
                  key={p}
                  className={`sa-theme-opt${preset === p ? ' active' : ''}`}
                  onClick={() => { setPreset(p); setThemeOpen(false); }}
                >
                  <span className="sa-theme-swatch" style={{ background: PRESETS[p].colors.primary }} />
                  {PRESETS[p].label}
                  {preset === p && <span className="sa-theme-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Change M-PIN */}
        <button className="sa-hbtn" onClick={() => navigate('/change-mpin')} title="Change M-PIN">
          <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Logout */}
        <button className="sa-hbtn" onClick={handleLogout} title="Logout">
          <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
        </button>

        {/* User chip */}
        <div className="sa-user-chip">
          <div className="sa-avatar">{initials}</div>
          <div>
            <div className="sa-user-name">{user?.name}</div>
            <div className="sa-user-role">{user?.role}</div>
          </div>
        </div>
      </header>

      <div className="sa-body">
        {/* ── Mobile overlay backdrop ── */}
        <div
          className={`sa-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* ── Left Accordion Sidebar ── */}
        <aside className={`sa-sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
          <div className="sa-sb-head">Navigation</div>

          {/* Dashboard — top-level single link */}
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => `sa-sb-single${isActive ? ' active' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Dashboard
          </NavLink>

          {/* Module accordion groups */}
          {visibleGroups.map((group) => (
            <div key={group.id} className="sa-mg">
              {group.landingPath ? (
                /* Navigable group header — label links, chevron toggles */
                <div
                  className={[
                    'sa-mg-h',
                    openGroups.has(group.id) ? 'open' : '',
                    activeGroupId === group.id ? 'active-group' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  <NavLink
                    to={group.landingPath}
                    onClick={() => setOpenGroups((prev) => new Set([...prev, group.id]))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '0.55rem 0.75rem', textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="sa-mg-ic">{group.icon}</div>
                    <span className="sa-mg-t">{group.label}</span>
                  </NavLink>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.55rem 0.6rem', display: 'flex', alignItems: 'center', color: 'inherit', opacity: 0.7 }}
                    aria-label="Expand"
                  >
                    <svg className="sa-mg-cv" viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* Toggle-only group header */
                <button
                  className={[
                    'sa-mg-h',
                    openGroups.has(group.id) ? 'open' : '',
                    activeGroupId === group.id ? 'active-group' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="sa-mg-ic">{group.icon}</div>
                  <span className="sa-mg-t">{group.label}</span>
                  <svg className="sa-mg-cv" viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}

              {openGroups.has(group.id) && (
                <div className="sa-mi-list">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end ?? false}
                      className={({ isActive }) => `sa-mi${isActive ? ' active' : ''}`}
                    >
                      <span className="sa-dot" style={{ background: item.dot }} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* ── Main Content ── */}
        <main className="sa-main">
          {children}
        </main>
      </div>
    </div>
  );
}
