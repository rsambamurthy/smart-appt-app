import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetMenuConfigQuery, useSaveMenuConfigMutation } from '../../store/api/systemApi';

// ── Menu structure — mirrors Layout.tsx NAV_GROUPS ────────────────────────────
// Only includes configurable roles (not SUPER_USER)

const ROLES = [
  { id: 'MANAGER',    label: 'Manager',    color: '#0095db' },
  { id: 'TREASURER',  label: 'Treasurer',  color: '#a855f7' },
  { id: 'COMMITTEE',  label: 'Committee',  color: '#f59e0b' },
  { id: 'RESIDENT',   label: 'Resident',   color: '#22c55e' },
  { id: 'GATE_STAFF', label: 'Gate Staff', color: '#ec4899' },
];

interface MenuItem {
  id: string;
  label: string;
  roles: string[];  // roles that can see this item by default
}
interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const MENU_STRUCTURE: MenuGroup[] = [
  {
    label: 'Configuration',
    items: [
      { id: 'dues_config',         label: 'Fee Configuration',  roles: ['TREASURER'] },
      { id: 'razorpay_config',     label: 'Razorpay',           roles: ['TREASURER'] },
      { id: 'expenses_categories', label: 'Expense Categories', roles: ['TREASURER', 'MANAGER'] },
      { id: 'admin_users',         label: 'Manage Users',       roles: ['MANAGER'] },
      { id: 'admin_units',         label: 'Manage Units',       roles: ['MANAGER'] },
    ],
  },
  {
    label: 'Dues & Payments',
    items: [
      { id: 'dues_bills',    label: 'Bills & Payments', roles: ['TREASURER', 'COMMITTEE', 'MANAGER'] },
      { id: 'dues_one_time', label: 'One-Time Dues',    roles: ['TREASURER', 'COMMITTEE', 'MANAGER'] },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { id: 'expenses_list',        label: 'Expenses List', roles: ['TREASURER', 'COMMITTEE'] },
      { id: 'dues_other_receipts',  label: 'Receipts',      roles: ['TREASURER', 'COMMITTEE', 'MANAGER'] },
      { id: 'transactions_reports', label: 'Reports',       roles: ['TREASURER', 'COMMITTEE', 'MANAGER'] },
    ],
  },
  {
    label: 'Residents',
    items: [
      { id: 'dues_my_bills',         label: 'My Bills',         roles: ['RESIDENT'] },
      { id: 'maintenance_list',      label: 'Service Requests', roles: ['MANAGER', 'RESIDENT', 'COMMITTEE', 'TREASURER', 'GATE_STAFF'] },
      { id: 'maintenance_new',       label: 'Raise Request',    roles: ['MANAGER', 'RESIDENT', 'COMMITTEE', 'TREASURER', 'GATE_STAFF'] },
      { id: 'announcements_feed',    label: 'Announcements',    roles: ['MANAGER', 'TREASURER', 'COMMITTEE', 'RESIDENT', 'GATE_STAFF'] },
      { id: 'expenses_transparency', label: 'Transparency',     roles: ['MANAGER', 'TREASURER', 'COMMITTEE', 'RESIDENT', 'GATE_STAFF'] },
    ],
  },
  {
    label: 'Documents',
    items: [
      { id: 'announcements_docs', label: 'Documents', roles: ['MANAGER', 'TREASURER', 'COMMITTEE', 'RESIDENT', 'GATE_STAFF'] },
    ],
  },
  {
    label: 'Visitors',
    items: [
      { id: 'visitors_log',        label: 'Visitor Log',    roles: ['MANAGER', 'GATE_STAFF'] },
      { id: 'visitors_preapprove', label: 'Pre-Approve',    roles: ['RESIDENT'] },
      { id: 'visitors_gate',       label: 'Gate Dashboard', roles: ['GATE_STAFF'] },
    ],
  },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: on ? 'var(--color-primary)' : '#cbd5e1',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MenuConfigPage() {
  const { data, isLoading } = useGetMenuConfigQuery();
  const [saveConfig, { isLoading: isSaving }] = useSaveMenuConfigMutation();

  const [config, setConfig] = useState<Record<string, Record<string, boolean>>>({});
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data?.data) setConfig(data.data);
  }, [data]);

  const toggle = (role: string, itemId: string) => {
    // Find the item's default access for this role
    const item = MENU_STRUCTURE.flatMap((g) => g.items).find((i) => i.id === itemId);
    const defaultOn = item ? item.roles.includes(role) : false;
    setConfig((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [itemId]: !(prev[role]?.[itemId] ?? defaultOn) },
    }));
    setSuccess(false);
    setError('');
  };

  const handleSave = async () => {
    setSuccess(false);
    setError('');
    // Save ALL role × item combinations (Super User controls everything)
    const items: Array<{ group_id: string; role: string; enabled: boolean }> = [];
    for (const group of MENU_STRUCTURE) {
      for (const item of group.items) {
        for (const role of ROLES) {
          items.push({
            group_id: item.id,
            role: role.id,
            // default: enabled if role is in the item's coded role list
            enabled: config[role.id]?.[item.id] ?? item.roles.includes(role.id),
          });
        }
      }
    }
    try {
      await saveConfig(items).unwrap();
      setSuccess(true);
    } catch {
      setError('Failed to save configuration.');
    }
  };

  const thStyle: React.CSSProperties = {
    padding: '0.7rem 0.75rem',
    textAlign: 'center',
    borderBottom: '2px solid var(--color-border)',
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap' as const,
    minWidth: 90,
  };

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'System Settings' }, { label: 'Menu Configuration' }]}
        onSave={handleSave}
        saveLabel="Save Configuration"
        saving={isSaving}
      />

      <div style={{ padding: '1.5rem 2rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Toggle individual menu items on or off per role. A cell shows <strong>—</strong> when that role never had access to the item.
          SUPER_USER always sees everything and is not configurable here.
        </p>

        {isLoading ? (
          <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-card)' }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: 220, borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Menu Item
                  </th>
                  {ROLES.map((r) => (
                    <th key={r.id} style={thStyle}>
                      <span style={{ color: r.color }}>{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MENU_STRUCTURE.map((group) => (
                  <>
                    {/* Group header row */}
                    <tr key={`grp_${group.label}`} style={{ background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))' }}>
                      <td
                        colSpan={ROLES.length + 1}
                        style={{
                          padding: '0.45rem 1rem',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--color-primary)',
                          borderTop: '1px solid var(--color-border)',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        {group.label}
                      </td>
                    </tr>

                    {/* Item rows */}
                    {group.items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.65rem 1rem 0.65rem 1.5rem', color: 'var(--color-text)' }}>
                          {item.label}
                        </td>
                        {ROLES.map((role) => {
                          // Default on = role is in the item's coded role list
                          const enabled = config[role.id]?.[item.id] ?? item.roles.includes(role.id);
                          return (
                            <td key={role.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <Toggle
                                  on={enabled}
                                  onChange={() => toggle(role.id, item.id)}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: '0.875rem' }}>
            ✓ Menu configuration saved. Users will see the updated menus on their next page load.
          </div>
        )}
      </div>
    </Layout>
  );
}
