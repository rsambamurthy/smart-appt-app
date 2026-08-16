import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetMobileConfigQuery, useSaveMobileConfigMutation,
} from '../../store/api/systemApi';
import { useListAssociationsQuery } from '../../store/api/associationsApi';
import { AssociationPicker, pageBtn } from './menuConfigUi';

/**
 * Logo, app name and theme colour for one association's mobile app.
 *
 * A super user always reaches this. A manager only sees the sidebar link
 * once a super user grants it via Web Menu by Role — the item is coded
 * SUPER_USER-only by default (Layout.tsx, system_branding). The backend
 * enforces the same split independently: a manager's PUT here can change
 * only these three fields, on their own association, regardless of what the
 * request body contains (system.controller.ts).
 */

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: '#64748b',
  display: 'block', marginBottom: 6,
} as const;

const inputStyle = {
  width: '100%', maxWidth: 420, padding: '8px 11px', borderRadius: 8,
  border: '1px solid #cbd5e1', fontSize: 13.5, boxSizing: 'border-box',
} as const;

type Draft = { app_name: string; logo_url: string; theme_color: string };
const EMPTY_DRAFT: Draft = { app_name: '', logo_url: '', theme_color: '' };
const DEFAULT_COLOR = '#0095db';

export default function BrandingPage() {
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

  const { data, isLoading, error } = useGetMobileConfigQuery(assocId, { skip: !assocId });
  const [save, { isLoading: saving }] = useSaveMobileConfigMutation();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [dirty, setDirty] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDraft({
      app_name: data.data.app_name ?? '',
      logo_url: data.data.logo_url ?? '',
      theme_color: data.data.theme_color ?? '',
    });
    setDirty(false);
    setLogoError(false);
  }, [data]);

  const set = (patch: Partial<Draft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    setDirty(true);
    if ('logo_url' in patch) setLogoError(false);
  };

  const onSave = async () => {
    if (!assocId) return;
    await save({
      associationId: assocId,
      body: {
        app_name: draft.app_name.trim() || null,
        logo_url: draft.logo_url.trim() || null,
        theme_color: draft.theme_color.trim() || null,
      },
    }).unwrap();
    setDirty(false);
  };

  const swatch = draft.theme_color || DEFAULT_COLOR;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'Branding' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 640 }}>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap',
                      alignItems: 'flex-end', marginBottom: 20 }}>
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

        {error ? (
          <div style={{ border: '1px solid #fca5a5', background: '#fef2f2',
                        borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#b91c1c' }}>
              Could not load the branding configuration.
            </div>
            <div style={{ fontSize: 12.5, color: '#7f1d1d', marginTop: 4 }}>
              {'status' in error && error.status === 403
                ? 'You are not permitted to configure this association.'
                : `Request failed${'status' in error ? ` (${String(error.status)})` : ''}.`}
            </div>
          </div>
        ) : isLoading || !assocId ? (
          <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12,
                        background: '#fff', padding: '20px 22px', display: 'grid', gap: 20 }}>

            {/* App name */}
            <div>
              <label style={labelStyle}>App name</label>
              <input
                type="text"
                value={draft.app_name}
                onChange={e => set({ app_name: e.target.value })}
                placeholder="SmartAppt"
                maxLength={60}
                style={inputStyle}
              />
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
                Shown as the browser tab title on the web app. Leave blank to use the default.
              </div>
            </div>

            {/* Logo */}
            <div>
              <label style={labelStyle}>Logo URL</label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <input
                  type="text"
                  value={draft.logo_url}
                  onChange={e => set({ logo_url: e.target.value })}
                  placeholder="https://…/logo.png"
                  style={inputStyle}
                />
                <div style={{
                  width: 44, height: 44, borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#f8fafc', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
                }}>
                  {draft.logo_url && !logoError ? (
                    <img
                      src={draft.logo_url}
                      alt="Logo preview"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span style={{ fontSize: 10, color: '#cbd5e1' }}>
                      {draft.logo_url ? 'Bad URL' : 'None'}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
                A direct link to an image file — this app does not host uploads. Leave blank
                to show no logo.
              </div>
            </div>

            {/* Theme colour */}
            <div>
              <label style={labelStyle}>Theme colour</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(swatch) ? swatch : DEFAULT_COLOR}
                  onChange={e => set({ theme_color: e.target.value })}
                  style={{ width: 40, height: 34, padding: 0, border: '1px solid #cbd5e1',
                           borderRadius: 6, cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  value={draft.theme_color}
                  onChange={e => set({ theme_color: e.target.value })}
                  placeholder="#0095db"
                  maxLength={20}
                  style={{ ...inputStyle, maxWidth: 160 }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
                Accent colour used across the mobile app. Leave blank for the default blue.
              </div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, lineHeight: 1.65 }}>
          These three fields only. Feature flags, push settings and the mobile menu matrix
          are configured separately (Mobile Menu by Role) and a manager cannot reach them
          from here, even by editing the request directly — the server enforces that.
        </div>
      </div>
    </Layout>
  );
}
