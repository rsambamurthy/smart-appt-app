import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetMenuConfigQuery, useSaveMenuConfigMutation,
  useGetMobileConfigQuery, useSaveMobileConfigMutation,
  MobileConfig,
} from '../../store/api/systemApi';
import { useListAssociationsQuery } from '../../store/api/associationsApi';

// ── Web menu structure ────────────────────────────────────────────────────────

const ROLES = [
  { id: 'MANAGER',    label: 'Manager',    color: '#0095db' },
  { id: 'TREASURER',  label: 'Treasurer',  color: '#a855f7' },
  { id: 'COMMITTEE',  label: 'Committee',  color: '#f59e0b' },
  { id: 'RESIDENT',   label: 'Resident',   color: '#22c55e' },
  { id: 'GATE_STAFF', label: 'Gate Staff', color: '#ec4899' },
];

interface MenuItem { id: string; label: string; roles: string[] }
interface MenuGroup { label: string; items: MenuItem[] }

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
    label: 'Accounting',
    items: [
      { id: 'chart_of_accounts', label: 'Chart of Accounts', roles: ['MANAGER', 'TREASURER'] },
      { id: 'journal_entries',   label: 'Journal Entries',   roles: ['MANAGER', 'TREASURER', 'COMMITTEE'] },
      { id: 'ledger',            label: 'Ledger',            roles: ['MANAGER', 'TREASURER', 'COMMITTEE'] },
      { id: 'pnl',               label: 'Profit & Loss',     roles: ['MANAGER', 'TREASURER', 'COMMITTEE'] },
      { id: 'balance_sheet',     label: 'Balance Sheet',     roles: ['MANAGER', 'TREASURER', 'COMMITTEE'] },
    ],
  },
  {
    label: 'Residents',
    items: [
      { id: 'dues_my_bills',         label: 'My Bills',         roles: ['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER'] },
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
      { id: 'visitors_preapprove', label: 'Pre-Approve',    roles: ['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER'] },
      { id: 'visitors_gate',       label: 'Gate Dashboard', roles: ['GATE_STAFF'] },
    ],
  },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────

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

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, on, onChange }: { label: string; description: string; on: boolean; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>{description}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

// ── Web Menu tab ──────────────────────────────────────────────────────────────

function WebMenuTab() {
  const { data, isLoading } = useGetMenuConfigQuery();
  const [saveConfig, { isLoading: isSaving }] = useSaveMenuConfigMutation();
  const [config, setConfig] = useState<Record<string, Record<string, boolean>>>({});
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (data?.data) setConfig(data.data); }, [data]);

  const toggle = (role: string, itemId: string) => {
    const item = MENU_STRUCTURE.flatMap((g) => g.items).find((i) => i.id === itemId);
    const defaultOn = item ? item.roles.includes(role) : false;
    setConfig((prev) => ({ ...prev, [role]: { ...(prev[role] ?? {}), [itemId]: !(prev[role]?.[itemId] ?? defaultOn) } }));
    setSuccess(false); setError('');
  };

  const handleSave = async () => {
    setSuccess(false); setError('');
    const items: Array<{ group_id: string; role: string; enabled: boolean }> = [];
    for (const group of MENU_STRUCTURE)
      for (const item of group.items)
        for (const role of ROLES)
          items.push({ group_id: item.id, role: role.id, enabled: config[role.id]?.[item.id] ?? item.roles.includes(role.id) });
    try { await saveConfig(items).unwrap(); setSuccess(true); }
    catch { setError('Failed to save configuration.'); }
  };

  const thStyle: React.CSSProperties = {
    padding: '0.7rem 0.75rem', textAlign: 'center', borderBottom: '2px solid var(--color-border)',
    fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em',
    whiteSpace: 'nowrap', minWidth: 90,
  };

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
        Toggle individual menu items on or off per role. SUPER_USER always sees everything and is not configurable here.
      </p>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving…' : 'Save Web Menu Config'}
        </button>
      </div>
      {isLoading ? <p style={{ color: 'var(--color-muted)' }}>Loading…</p> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-card)' }}>
                <th style={{ ...thStyle, textAlign: 'left', width: 220, color: 'var(--color-text-secondary)' }}>Menu Item</th>
                {ROLES.map((r) => <th key={r.id} style={thStyle}><span style={{ color: r.color }}>{r.label}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {MENU_STRUCTURE.map((group) => (
                <>
                  <tr key={`grp_${group.label}`} style={{ background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))' }}>
                    <td colSpan={ROLES.length + 1} style={{ padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                      {group.label}
                    </td>
                  </tr>
                  {group.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.65rem 1rem 0.65rem 1.5rem', color: 'var(--color-text)' }}>{item.label}</td>
                      {ROLES.map((role) => {
                        const enabled = config[role.id]?.[item.id] ?? item.roles.includes(role.id);
                        return (
                          <td key={role.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <Toggle on={enabled} onChange={() => toggle(role.id, item.id)} />
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
      {error && <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: '0.875rem' }}>✓ Web menu configuration saved.</div>}
    </div>
  );
}

// ── Mobile App tab ────────────────────────────────────────────────────────────

const MOBILE_DEFAULTS: MobileConfig = {
  feature_bills: true, feature_announcements: true, feature_complaints: true, feature_visitors: true,
  push_dues_reminder: true, push_announcements: true, push_visitor_alerts: true,
  login_mpin_enabled: true, login_biometric: false, login_otp_only: false,
  app_name: null, theme_color: null, logo_url: null,
};

function MobileAppTab() {
  const { data: assocData } = useListAssociationsQuery();
  const associations = (assocData?.data ?? []) as { id: string; name: string }[];

  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<MobileConfig>(MOBILE_DEFAULTS);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { data: cfgData, isFetching } = useGetMobileConfigQuery(selectedId, { skip: !selectedId });
  const [saveMobileConfig, { isLoading: isSaving }] = useSaveMobileConfigMutation();

  useEffect(() => {
    if (cfgData?.data) setForm({ ...MOBILE_DEFAULTS, ...cfgData.data });
  }, [cfgData]);

  const set = <K extends keyof MobileConfig>(key: K, value: MobileConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(false); setError('');
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSuccess(false); setError('');
    try {
      await saveMobileConfig({ associationId: selectedId, body: form }).unwrap();
      setSuccess(true);
    } catch { setError('Failed to save mobile configuration.'); }
  };

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', width: '100%',
  };

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
        Configure mobile app settings per association. These settings are read by the SmartAppt mobile app at login.
      </p>

      {/* Association picker */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Select Association</label>
        <select
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setSuccess(false); setError(''); }}
          style={{ ...inputStyle, maxWidth: 340 }}
        >
          <option value="">— Choose an association —</option>
          {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {isFetching && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
      </div>

      {!selectedId ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0' }}>
          Select an association above to configure its mobile app settings.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Left column */}
          <div>
            {/* Features */}
            <SectionCard title="App Features" icon="📱">
              <ToggleRow label="My Bills & Payments" description="Residents can view and pay dues" on={form.feature_bills} onChange={() => set('feature_bills', !form.feature_bills)} />
              <ToggleRow label="Announcements & Feed" description="Community notices, polls, and posts" on={form.feature_announcements} onChange={() => set('feature_announcements', !form.feature_announcements)} />
              <ToggleRow label="Complaints & Maintenance" description="Raise and track service requests" on={form.feature_complaints} onChange={() => set('feature_complaints', !form.feature_complaints)} />
              <ToggleRow label="Visitor Management" description="Approve and log gate visitors" on={form.feature_visitors} onChange={() => set('feature_visitors', !form.feature_visitors)} />
            </SectionCard>

            {/* Push Notifications */}
            <SectionCard title="Push Notifications" icon="🔔">
              <ToggleRow label="Dues Reminders" description="Notify residents before and after due dates" on={form.push_dues_reminder} onChange={() => set('push_dues_reminder', !form.push_dues_reminder)} />
              <ToggleRow label="Announcements" description="Push when new announcements are posted" on={form.push_announcements} onChange={() => set('push_announcements', !form.push_announcements)} />
              <ToggleRow label="Visitor Alerts" description="Notify residents when a visitor arrives at the gate" on={form.push_visitor_alerts} onChange={() => set('push_visitor_alerts', !form.push_visitor_alerts)} />
            </SectionCard>
          </div>

          {/* Right column */}
          <div>
            {/* Login Options */}
            <SectionCard title="Login Options" icon="🔐">
              <ToggleRow label="M-PIN Login" description="Allow residents to set and use a 6-digit M-PIN" on={form.login_mpin_enabled} onChange={() => set('login_mpin_enabled', !form.login_mpin_enabled)} />
              <ToggleRow label="Biometric Login" description="Enable fingerprint / face ID login (device must support it)" on={form.login_biometric} onChange={() => set('login_biometric', !form.login_biometric)} />
              <ToggleRow
                label="OTP Only Mode"
                description="Disable all other login methods — only OTP via SMS"
                on={form.login_otp_only}
                onChange={() => set('login_otp_only', !form.login_otp_only)}
              />
              {form.login_otp_only && (
                <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6, padding: '8px 10px', fontSize: 11.5, color: '#854d0e' }}>
                  ⚠ OTP Only mode disables M-PIN and Biometric login for this association.
                </div>
              )}
            </SectionCard>

            {/* Branding */}
            <SectionCard title="App Branding" icon="🎨">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>App Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vishranthi Residents"
                  value={form.app_name ?? ''}
                  onChange={(e) => set('app_name', e.target.value || null)}
                  style={inputStyle}
                  maxLength={100}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Shown on the mobile app home screen and splash screen.</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Theme Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={form.theme_color ?? '#0095db'}
                    onChange={(e) => set('theme_color', e.target.value)}
                    style={{ width: 40, height: 34, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    type="text"
                    placeholder="#0095db"
                    value={form.theme_color ?? ''}
                    onChange={(e) => set('theme_color', e.target.value || null)}
                    style={{ ...inputStyle, width: 100 }}
                    maxLength={7}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Primary colour for buttons, header, icons.</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Logo URL</label>
                <input
                  type="url"
                  placeholder="https://cdn.example.com/logo.png"
                  value={form.logo_url ?? ''}
                  onChange={(e) => set('logo_url', e.target.value || null)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>PNG or SVG, shown on the splash and login screens.</div>
                {form.logo_url && (
                  <img src={form.logo_url} alt="Logo preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    style={{ marginTop: 8, height: 48, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', padding: 4 }}
                  />
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {selectedId && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving || isFetching}>
            {isSaving ? 'Saving…' : 'Save Mobile Config'}
          </button>
          {success && <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>✓ Saved successfully</span>}
          {error && <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'web' | 'mobile';

export default function MenuConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('web');

  const tabBtn = (tab: Tab, label: string, icon: string): React.CSSProperties => ({
    padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
    borderRadius: '8px 8px 0 0', marginRight: 4, display: 'flex', alignItems: 'center', gap: 6,
    background: activeTab === tab ? '#fff' : 'transparent',
    color: activeTab === tab ? '#1e293b' : '#64748b',
    borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
  });

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'App Configuration' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
          <button style={tabBtn('web', 'Web Menu', '🖥️')} onClick={() => setActiveTab('web')}>
            🖥️ Web Menu
          </button>
          <button style={tabBtn('mobile', 'Mobile App', '📱')} onClick={() => setActiveTab('mobile')}>
            📱 Mobile App
          </button>
        </div>

        {activeTab === 'web' ? <WebMenuTab /> : <MobileAppTab />}
      </div>
    </Layout>
  );
}
