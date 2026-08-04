import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout, { NAV_GROUPS } from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetWebMenuConfigQuery, useSaveWebMenuConfigMutation,
} from '../../store/api/systemApi';
import { useListAssociationsQuery } from '../../store/api/associationsApi';
import {
  ROLE_LABEL, orderRoles, roleTab, pageBtn, AssociationPicker,
} from './menuConfigUi';

/**
 * Which web menu items each role sees, per association.
 *
 * The item list comes from NAV_GROUPS — the array Layout actually draws the
 * sidebar from. This screen used to keep its own copy, and it had drifted so
 * far that twenty-four live menu items could not be configured at all while
 * five it did offer no longer existed. There is one array now.
 *
 * Only departures from an item's default role list are stored. Saving the full
 * matrix would freeze the association on today's defaults, so a menu item
 * added in a later release would never appear for anyone.
 */

export default function WebMenuPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const isSuper = user?.role === 'SUPER_USER';

  const { data: assocData } = useListAssociationsQuery(undefined, { skip: !isSuper });
  const associations = useMemo(
    () => (assocData?.data ?? []) as Array<{ id: string; name: string }>,
    [assocData],
  );

  // A manager configures their own association and is not offered a choice.
  const [assocId, setAssocId] = useState(isSuper ? '' : (user?.association_id ?? ''));
  useEffect(() => {
    if (isSuper && !assocId && associations.length) setAssocId(associations[0].id);
  }, [isSuper, associations, assocId]);

  const { data, isLoading, error } = useGetWebMenuConfigQuery(assocId, { skip: !assocId });
  const [save, { isLoading: saving }] = useSaveWebMenuConfigMutation();

  const editable = useMemo(
    () => data?.editable_roles ?? [],
    [data],
  );
  const [role, setRole]   = useState('');
  const [draft, setDraft] = useState<Record<string, Record<string, boolean>>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (editable.length && !editable.includes(role)) setRole(orderRoles(editable)[0]);
  }, [editable, role]);

  useEffect(() => {
    if (!data) return;
    setDraft(data.data ?? {});
    setDirty(false);
  }, [data]);

  const items = useMemo(() => NAV_GROUPS.flatMap(g => g.items), []);

  /** What this role sees for an item, defaults included. */
  const isOn = (itemId: string) => {
    const stored = draft[role]?.[itemId];
    if (stored !== undefined) return stored;
    return items.find(i => i.id === itemId)?.roles.includes(role) ?? false;
  };
  const isOverridden = (itemId: string) => draft[role]?.[itemId] !== undefined;

  const toggle = (itemId: string) => {
    const next = !isOn(itemId);
    const def  = items.find(i => i.id === itemId)?.roles.includes(role) ?? false;
    setDraft(prev => {
      const forRole = { ...(prev[role] ?? {}) };
      // Back to the default? Drop the override rather than storing agreement,
      // so a later change to the default still reaches this association.
      if (next === def) delete forRole[itemId];
      else forRole[itemId] = next;
      return { ...prev, [role]: forRole };
    });
    setDirty(true);
  };

  const flatten = (d: Record<string, Record<string, boolean>>) =>
    Object.entries(d).flatMap(([r, cells]) =>
      Object.entries(cells).map(([group_id, enabled]) => ({ group_id, role: r, enabled })));

  const onSave = async () => {
    if (!assocId) return;
    await save({ associationId: assocId, items: flatten(draft) }).unwrap();
    setDirty(false);
  };

  const resetRole = async () => {
    if (!assocId) return;
    const next = { ...draft, [role]: {} };
    setDraft(next);
    await save({ associationId: assocId, items: flatten(next) }).unwrap();
    setDirty(false);
  };

  const visibleCount  = items.filter(i => isOn(i.id)).length;
  const overrideCount = Object.keys(draft[role] ?? {}).length;
  const countFor = (r: string) => Object.keys(draft[r] ?? {}).length;

  const groupHeader: CSSProperties = {
    padding: '8px 15px', fontSize: 11, fontWeight: 700, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f8fafc',
    borderBottom: '1px solid #f1f5f9',
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'Web Menu by Role' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 940 }}>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap',
                      alignItems: 'flex-end', marginBottom: 16 }}>
          <AssociationPicker
            isSuper={isSuper}
            associations={associations}
            value={assocId}
            onChange={setAssocId}
          />
          <button onClick={onSave} disabled={!dirty || saving}
            style={{ ...pageBtn, background: dirty ? '#1d4ed8' : '#e2e8f0',
                     color: dirty ? '#fff' : '#94a3b8',
                     borderColor: dirty ? '#1d4ed8' : '#e2e8f0' }}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
          {orderRoles(editable).map(r => (
            <button key={r} onClick={() => setRole(r)} style={roleTab(r === role)}>
              {ROLE_LABEL[r] ?? r}
              {countFor(r) > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11,
                               color: r === role ? '#93c5fd' : '#b45309' }}>
                  {countFor(r)}
                </span>
              )}
            </button>
          ))}
        </div>

        {!isSuper && (
          <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc',
                        borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            The Manager role is not listed. Hiding this screen from managers would
            lock you out of the only place that could undo it — ask a super user if
            the manager menu needs changing.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>
            {role
              ? `${visibleCount} of ${items.length} items visible to ${ROLE_LABEL[role] ?? role}`
              : `${items.length} menu items`}
            {overrideCount > 0 && (
              <span style={{ color: '#b45309', fontWeight: 600 }}>
                {' '}· {overrideCount} changed from default
              </span>
            )}
          </div>
          {overrideCount > 0 && (
            <button onClick={resetRole} style={{ ...pageBtn, fontSize: 12, padding: '4px 10px' }}>
              Reset this role to defaults
            </button>
          )}
        </div>

        {error ? (
          // Without this the screen sat on "Loading…" for ever whenever the
          // request failed — which is exactly what a not-yet-deployed backend
          // looks like, and it reads as a hung page rather than a failed call.
          <div style={{ border: '1px solid #fca5a5', background: '#fef2f2',
                        borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#b91c1c' }}>
              Could not load the menu configuration.
            </div>
            <div style={{ fontSize: 12.5, color: '#7f1d1d', marginTop: 4 }}>
              {'status' in error && error.status === 404
                ? 'The server does not have this endpoint yet — the backend deploy may still be building, or it failed to start.'
                : 'status' in error && error.status === 403
                ? 'You are not permitted to configure this association.'
                : `Request failed${'status' in error ? ` (${String(error.status)})` : ''}.`}
            </div>
          </div>
        ) : isLoading || !role ? (
          <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12,
                        background: '#fff', overflow: 'hidden' }}>
            {NAV_GROUPS.map(g => (
              <div key={g.id}>
                <div style={groupHeader}>{g.label}</div>
                {g.items.map(it => {
                  const on = isOn(it.id);
                  return (
                    <div key={it.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 15px', borderBottom: '1px solid #f8fafc',
                    }}>
                      <label className="inline-check" style={{ flex: 1, minWidth: 0 }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(it.id)} />
                        <span style={{ fontSize: 13.5, color: on ? '#1e293b' : '#94a3b8' }}>
                          {it.label}
                        </span>
                        {isOverridden(it.id) && (
                          <span title="Changed from the default for this role"
                            style={{ marginLeft: 6, width: 6, height: 6, borderRadius: 99,
                                     background: '#f59e0b', display: 'inline-block' }} />
                        )}
                      </label>
                      <span style={{ fontSize: 11.5, color: '#cbd5e1' }}>{it.path}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14,
                      lineHeight: 1.65, maxWidth: 680 }}>
          Only the cells you change from the default are stored, so a menu item added
          in a future release appears for the right roles on its own. The amber dot
          marks a cell that departs from the default.
          <br /><br />
          Super users always see every menu item and are not configurable here. This
          controls what the sidebar <em>shows</em>; it is not a security boundary, as
          every page and endpoint still enforces its own roles.
        </div>
      </div>
    </Layout>
  );
}
