import { useEffect, useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetMobileConfigQuery,
  useSaveMobileConfigMutation,
  type MenuItemsMap,
  type MenuItemConfig,
} from '../../store/api/systemApi';
import { useListAssociationsQuery } from '../../store/api/associationsApi';

// ── Menu item definitions ────────────────────────────────────────────────────

interface MobileMenuItem {
  id: string;
  label: string;
  supportsPost: boolean;
}

interface QuadrantDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  items: MobileMenuItem[];
}

const QUADRANTS: QuadrantDef[] = [
  {
    id: 'community',
    label: 'Community',
    icon: '🏘️',
    color: '#22c55e',
    items: [
      { id: 'dues_my_bills',         label: 'My Bills',           supportsPost: false },
      { id: 'announcements_feed',    label: 'Announcements',      supportsPost: false },
      { id: 'maintenance_list',      label: 'Service Requests',   supportsPost: true  },
      { id: 'maintenance_new',       label: 'Raise Request',      supportsPost: true  },
      { id: 'expenses_transparency', label: 'Transparency',       supportsPost: false },
      { id: 'visitors_preapprove',   label: 'Pre-Approve Visitor',supportsPost: true  },
      { id: 'announcements_docs',    label: 'Documents',          supportsPost: false },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: '📊',
    color: '#7c3aed',
    items: [
      { id: 'journal_entries', label: 'Journal Entries', supportsPost: true  },
      { id: 'ledger',          label: 'Ledger',          supportsPost: false },
      { id: 'pnl',             label: 'Profit & Loss',   supportsPost: false },
      { id: 'balance_sheet',   label: 'Balance Sheet',   supportsPost: false },
      { id: 'fy_closure',      label: 'FY Closure',      supportsPost: true  },
    ],
  },
  {
    id: 'dues',
    label: 'Dues',
    icon: '💰',
    color: '#f59e0b',
    items: [
      { id: 'dues_bills',    label: 'Bills & Payments', supportsPost: true },
      { id: 'dues_one_time', label: 'One-Time Dues',    supportsPost: true },
    ],
  },
  {
    id: 'visitors',
    label: 'Visitors',
    icon: '🚪',
    color: '#0891b2',
    items: [
      { id: 'visitors_log',  label: 'Visitor Log',    supportsPost: false },
      { id: 'visitors_gate', label: 'Gate Dashboard', supportsPost: false },
    ],
  },
];

// Default: all items enabled, no post permission
function buildDefaults(): MenuItemsMap {
  const map: MenuItemsMap = {};
  for (const q of QUADRANTS) {
    for (const item of q.items) {
      map[item.id] = { enabled: true, can_post: false };
    }
  }
  return map;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Association {
  id: string;
  name: string;
}

export default function MobileConfigPage() {
  const { data: assocData } = useListAssociationsQuery();
  const associations: Association[] = (assocData?.data ?? []) as Association[];

  const [selectedAssocId, setSelectedAssocId] = useState<string>('');

  // Auto-select the first association when the list loads
  useEffect(() => {
    if (!selectedAssocId && associations.length > 0) {
      setSelectedAssocId(associations[0].id);
    }
  }, [associations, selectedAssocId]);

  const { data: configData, isLoading } = useGetMobileConfigQuery(selectedAssocId, {
    skip: !selectedAssocId,
  });

  const [saveConfig, { isLoading: isSaving }] = useSaveMobileConfigMutation();

  // Local state for the matrix
  const [matrix, setMatrix] = useState<MenuItemsMap>(buildDefaults());
  const [dirty, setDirty] = useState(false);

  // Sync from server whenever config loads / association changes
  useEffect(() => {
    const serverItems = configData?.data?.menu_items;
    const base = buildDefaults();
    if (serverItems) {
      for (const id of Object.keys(serverItems)) {
        if (base[id]) base[id] = { ...base[id], ...serverItems[id] };
      }
    }
    setMatrix(base);
    setDirty(false);
  }, [configData, selectedAssocId]);

  const toggle = (itemId: string, field: keyof MenuItemConfig) => {
    setMatrix((prev) => {
      const next = { ...prev, [itemId]: { ...prev[itemId], [field]: !prev[itemId][field] } };
      // If disabling an item, also clear can_post
      if (field === 'enabled' && !next[itemId].enabled) {
        next[itemId] = { ...next[itemId], can_post: false };
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedAssocId) return;
    await saveConfig({ associationId: selectedAssocId, body: { menu_items: matrix } });
    setDirty(false);
  };

  const enabledCount = Object.values(matrix).filter((v) => v.enabled).length;
  const totalCount   = Object.keys(matrix).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'Mobile App Config' }]} />

      <div style={{ padding: '1.5rem', maxWidth: '1100px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Mobile App Configuration
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Control which features residents can access in the mobile app.
      </p>

      {/* Association selector + save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Association:
          </label>
          <select
            value={selectedAssocId}
            onChange={(e) => setSelectedAssocId(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              minWidth: '220px',
            }}
          >
            {associations.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {enabledCount}/{totalCount} items enabled
          </span>
          <button
            onClick={handleSave}
            disabled={!dirty || isSaving || !selectedAssocId}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: dirty ? 'var(--primary)' : 'var(--border)',
              color: dirty ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: dirty ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {isSaving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
          Loading configuration…
        </div>
      ) : (
        <>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: '#22c55e', display: 'inline-block' }} />
              Enabled — residents can view this section
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: '#7c3aed', display: 'inline-block' }} />
              Can Post — residents can create/submit records
            </div>
          </div>

          {/* Quadrant grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {QUADRANTS.map((q) => (
              <QuadrantCard
                key={q.id}
                quadrant={q}
                matrix={matrix}
                onToggle={toggle}
              />
            ))}
          </div>
        </>
      )}
      </div>
    </Layout>
  );
}

// ── Quadrant card ─────────────────────────────────────────────────────────────

interface QuadrantCardProps {
  quadrant: QuadrantDef;
  matrix: MenuItemsMap;
  onToggle: (itemId: string, field: keyof MenuItemConfig) => void;
}

function QuadrantCard({ quadrant, matrix, onToggle }: QuadrantCardProps) {
  const enabledInGroup = quadrant.items.filter((i) => matrix[i.id]?.enabled).length;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: quadrant.color + '18',
        borderBottom: `2px solid ${quadrant.color}40`,
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.1rem' }}>{quadrant.icon}</span>
        <span style={{ fontWeight: 700, color: quadrant.color, fontSize: '0.95rem' }}>
          {quadrant.label}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          background: 'var(--bg-card)',
          padding: '0.15rem 0.5rem',
          borderRadius: '99px',
          border: '1px solid var(--border)',
        }}>
          {enabledInGroup}/{quadrant.items.length} on
        </span>
      </div>

      {/* Items */}
      <div style={{ padding: '0.5rem 0' }}>
        {quadrant.items.map((item) => {
          const cfg = matrix[item.id] ?? { enabled: false, can_post: false };
          return (
            <div key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              gap: '0.75rem',
              borderBottom: '1px solid var(--border)',
              opacity: cfg.enabled ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}>
              {/* Enabled toggle */}
              <Toggle
                checked={cfg.enabled}
                color={quadrant.color}
                onChange={() => onToggle(item.id, 'enabled')}
                title="Show / hide in app"
              />

              {/* Label */}
              <span style={{
                flex: 1,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                fontWeight: cfg.enabled ? 500 : 400,
              }}>
                {item.label}
              </span>

              {/* Can post chip — only for items that support it */}
              {item.supportsPost && (
                <button
                  onClick={() => cfg.enabled && onToggle(item.id, 'can_post')}
                  disabled={!cfg.enabled}
                  title={cfg.enabled ? 'Toggle create/submit permission' : 'Enable item first'}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '99px',
                    border: `1.5px solid ${cfg.can_post ? '#7c3aed' : 'var(--border)'}`,
                    background: cfg.can_post ? '#7c3aed20' : 'transparent',
                    color: cfg.can_post ? '#7c3aed' : 'var(--text-secondary)',
                    cursor: cfg.enabled ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cfg.can_post ? '✏️ Can Post' : '👁 View Only'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  color,
  onChange,
  title,
}: {
  checked: boolean;
  color: string;
  onChange: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onChange}
      title={title}
      aria-pressed={checked}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: checked ? color : 'var(--border)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}
