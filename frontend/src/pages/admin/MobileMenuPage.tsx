import { useEffect, useState, useMemo, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetMobileMenuMatrixQuery, useSaveMobileMenuMutation,
  type ResolvedMenuItem,
} from '../../store/api/systemApi';
import { useListAssociationsQuery } from '../../store/api/associationsApi';

/**
 * Which menu items each role sees in the mobile app.
 *
 * The item list is not held here — it comes from the server with the matrix.
 * The previous version of this screen kept its own copy, which is how it came
 * to offer toggles for items the app had never heard of, and to miss ones it
 * had. There is one catalogue now, in the backend, and both sides read it.
 */

const ROLE_LABEL: Record<string, string> = {
  SUPER_USER: 'Super User',
  MANAGER:    'Manager',
  TREASURER:  'Treasurer',
  COMMITTEE:  'Committee',
  RESIDENT:   'Resident',
  GATE_STAFF: 'Gate Staff',
};

// Ordered by how often they are configured, not alphabetically.
const ROLE_ORDER = ['RESIDENT', 'COMMITTEE', 'TREASURER', 'MANAGER', 'GATE_STAFF', 'SUPER_USER'];

const GROUP_LABEL: Record<string, string> = {
  community:  'Community',
  dues:       'Dues',
  accounting: 'Accounting',
  governance: 'Governance',
  gate:       'Visitors & Gate',
};

const btn: CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontSize: 13, cursor: 'pointer',
  fontWeight: 600,
};

type Overrides = Record<string, Record<string, Partial<ResolvedMenuItem>>>;

export default function MobileMenuPage() {
  const { data: assocData } = useListAssociationsQuery();
  // listAssociations is typed as unknown[]; narrow to just what this screen
  // needs rather than widening the shared endpoint's type from here.
  const associations = useMemo(
    () => (assocData?.data ?? []) as Array<{ id: string; name: string }>,
    [assocData],
  );

  const [assocId, setAssocId] = useState('');
  const [role, setRole]       = useState('RESIDENT');
  const [draft, setDraft]     = useState<Overrides>({});
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    if (!assocId && associations.length) setAssocId(associations[0].id);
  }, [associations, assocId]);

  const { data, isLoading } = useGetMobileMenuMatrixQuery(assocId, { skip: !assocId });
  const [save, { isLoading: saving }] = useSaveMobileMenuMutation();

  // The draft starts as what the server resolved — defaults included — so a
  // save with no edits is a no-op rather than a wholesale freeze of today's
  // defaults.
  useEffect(() => {
    if (!data) return;
    const seed: Overrides = {};
    for (const [r, items] of Object.entries(data.data.matrix)) {
      seed[r] = {};
      for (const [id, cfg] of Object.entries(items)) {
        seed[r][id] = { enabled: cfg.enabled, can_post: cfg.can_post };
      }
    }
    setDraft(seed);
    setDirty(false);
  }, [data]);

  const items      = data?.data.items ?? [];
  const overrides  = data?.data.overrides ?? {};
  const roles      = data?.data.roles ?? [];

  const orderedRoles = useMemo(
    () => [...roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)),
    [roles],
  );

  const cell = (id: string): Partial<ResolvedMenuItem> => draft[role]?.[id] ?? {};
  const isOverridden = (id: string) => overrides[role]?.[id] !== undefined;

  const set = (id: string, patch: Partial<ResolvedMenuItem>) => {
    setDraft(prev => {
      const forRole = { ...(prev[role] ?? {}) };
      const next = { ...(forRole[id] ?? {}), ...patch };
      // Losing visibility takes the post right with it; keeping a stale
      // can_post around is how a screen comes back writable by surprise.
      if (patch.enabled === false) next.can_post = false;
      forRole[id] = next;
      return { ...prev, [role]: forRole };
    });
    setDirty(true);
  };

  /**
   * Reset by removing this role's overrides and saving, rather than by trying
   * to reconstruct the defaults here. The server owns the defaults; an empty
   * override map means "whatever they are now", which also picks up any
   * default that has improved since this association was last configured.
   */
  const resetRole = async () => {
    if (!assocId) return;
    const next = { ...draft, [role]: {} };
    await save({ associationId: assocId, overrides: next }).unwrap();
    // The refetch reseeds the draft from the freshly resolved defaults.
  };

  const onSave = async () => {
    if (!assocId) return;
    await save({ associationId: assocId, overrides: draft }).unwrap();
    setDirty(false);
  };

  const byGroup = useMemo(() => {
    const g: Record<string, typeof items> = {};
    for (const it of items) (g[it.group] ??= []).push(it);
    return g;
  }, [items]);

  const enabledCount = items.filter(i => cell(i.id).enabled).length;
  const overrideCount = Object.keys(overrides[role] ?? {}).length;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'Mobile Menu by Role' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 940 }}>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap',
                      alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b',
                            display: 'block', marginBottom: 4 }}>
              Association
            </label>
            <select value={assocId} onChange={e => setAssocId(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8,
                       border: '1px solid #cbd5e1', fontSize: 13.5 }}>
              {associations.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button onClick={onSave} disabled={!dirty || saving}
            style={{ ...btn, background: dirty ? '#1d4ed8' : '#e2e8f0',
                     color: dirty ? '#fff' : '#94a3b8',
                     borderColor: dirty ? '#1d4ed8' : '#e2e8f0' }}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>

        {/* Role tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
          {orderedRoles.map(r => {
            const active = r === role;
            const n = Object.keys(overrides[r] ?? {}).length;
            return (
              <button key={r} onClick={() => setRole(r)}
                style={{ padding: '6px 13px', borderRadius: 99, border: 'none',
                         cursor: 'pointer', fontSize: 13,
                         fontWeight: active ? 700 : 500,
                         background: active ? '#1e293b' : '#f1f5f9',
                         color: active ? '#fff' : '#64748b' }}>
                {ROLE_LABEL[r] ?? r}
                {n > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11,
                                 color: active ? '#93c5fd' : '#b45309' }}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>
            {enabledCount} of {items.length} items visible to {ROLE_LABEL[role] ?? role}
            {overrideCount > 0 && (
              <span style={{ color: '#b45309', fontWeight: 600 }}>
                {' '}· {overrideCount} changed from default
              </span>
            )}
          </div>
          {overrideCount > 0 && (
            <button onClick={resetRole} style={{ ...btn, fontSize: 12, padding: '4px 10px' }}>
              Reset this role to defaults
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12,
                        background: '#fff', overflow: 'hidden' }}>
            {Object.entries(byGroup).map(([group, groupItems]) => (
              <div key={group}>
                <div style={{ padding: '8px 15px', fontSize: 11, fontWeight: 700,
                              color: '#94a3b8', textTransform: 'uppercase',
                              letterSpacing: '0.06em', background: '#f8fafc',
                              borderBottom: '1px solid #f1f5f9' }}>
                  {GROUP_LABEL[group] ?? group}
                </div>
                {groupItems.map(it => {
                  const c = cell(it.id);
                  return (
                    <div key={it.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 15px', borderBottom: '1px solid #f8fafc',
                    }}>
                      <label className="inline-check" style={{ flex: 1, minWidth: 0 }}>
                        <input type="checkbox" checked={c.enabled ?? false}
                          onChange={() => set(it.id, { enabled: !c.enabled })} />
                        <span style={{ fontSize: 13.5,
                                       color: c.enabled ? '#1e293b' : '#94a3b8' }}>
                          {it.label}
                        </span>
                        {isOverridden(it.id) && (
                          <span title="Changed from the default for this role"
                            style={{ marginLeft: 6, width: 6, height: 6, borderRadius: 99,
                                     background: '#f59e0b', display: 'inline-block' }} />
                        )}
                      </label>

                      {it.supports_post ? (
                        <label className="inline-check" style={{ opacity: c.enabled ? 1 : 0.35 }}>
                          <input type="checkbox" disabled={!c.enabled}
                            checked={c.can_post ?? false}
                            onChange={() => set(it.id, { can_post: !c.can_post })} />
                          <span style={{ fontSize: 12, color: '#64748b' }}>Can act</span>
                        </label>
                      ) : (
                        <span style={{ fontSize: 11.5, color: '#cbd5e1', width: 62,
                                       textAlign: 'right' }}>
                          view only
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14,
                      lineHeight: 1.65, maxWidth: 680 }}>
          Only the cells you change from the default are stored. That is deliberate:
          it means an item added in a future release appears for the right roles on
          its own, instead of staying invisible until someone remembers to enable it
          here. The amber dot marks a cell that departs from the default.
          <br /><br />
          This controls what the app <em>shows</em>. It is not a security boundary —
          every endpoint behind these screens still enforces its own roles, so hiding
          an item tidies the menu rather than locking a door.
        </div>
      </div>
    </Layout>
  );
}
