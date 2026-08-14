import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { clearCredentials } from '../../features/auth/authSlice';
import { useLogoutMutation } from '../../store/api/authApi';
import { baseApi } from '../../store/api/baseApi';
import { useMobileConfig } from '../../contexts/MobileConfigContext';
import LogoutIcon from '../../components/atoms/LogoutIcon';

// icon is a ReactNode rather than a string: most rows use an emoji, but
// Logout uses the shared LogoutIcon so it matches the one in the tab headers
// and the breadcrumb bar.
function MenuRow({ icon, label, sublabel, onClick, danger = false }: {
  icon: React.ReactNode; label: string; sublabel?: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '14px 16px', background: 'none', border: 'none',
        borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? '#fee2e2' : '#f1f5f9', fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: danger ? '#dc2626' : '#1e293b' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{sublabel}</div>}
      </div>
      {!danger && <span style={{ color: '#cbd5e1', fontSize: 18 }}>›</span>}
    </button>
  );
}

export default function MobileMorePage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const config = useMobileConfig();
  const [logout] = useLogoutMutation();

  const accentColor = config.theme_color ?? '#0095db';

  const handleLogout = async () => {
    try { await logout(undefined).unwrap(); } catch { /* ignore */ }
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100%', background: '#f1f5f9' }}>
      {/* Profile header */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
        padding: '52px 20px 28px',
        paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 20px))',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 28, marginBottom: 12,
        }}>
          👤
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{user?.name ?? '—'}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{user?.phone}</div>
        {user?.association_name && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>🏠 {user.association_name}</div>
        )}
        <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
            {user?.role ?? ''}
          </span>
          {user?.unit_number && (
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
              Unit {user.unit_number}
            </span>
          )}
        </div>
      </div>

      {/* Menu sections */}
      <div style={{ padding: '16px 16px 0' }}>

        {/* Logout — always at the top */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <MenuRow icon={<LogoutIcon size={19} />} label="Logout" sublabel="Sign out of your account" danger onClick={handleLogout} />
        </div>

        {/* Account */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f8fafc' }}>Account</div>
          {config.login_mpin_enabled && (
            <MenuRow icon="🔐" label="Change M-PIN" sublabel="Update your 4-digit security PIN" onClick={() => navigate('/change-mpin')} />
          )}
        </div>

        {/* Features. Two gates, and they mean different things: the feature flag
            turns something off for the whole association, the menu decides
            which roles among them see it. */}
        {(() => {
          /**
           * Rendered from what the server sent, not from a list kept here.
           *
           * The old version was six hardcoded rows. The catalogue has more, so
           * enabling anything outside those six in Mobile Menu by Role changed
           * the resolved menu and produced no visible effect — the screen had
           * no row to draw. One of the six also pointed at /dues/my-statement,
           * which is not a route inside the app, so it silently bounced to Home.
           *
           * Now every row carries its own label, icon and path from the
           * catalogue, and only items with a real mobile screen are sent. A new
           * item appears here without an app release.
           *
           * The association-wide feature flags still apply on top: the flag
           * turns something off for everyone, the menu decides which roles
           * among them see it.
           */
          const FLAG_FOR_GROUP: Record<string, boolean | undefined> = {
            community: undefined,
            gate:      config.feature_visitors,
          };

          const flagFor = (id: string, group: string): boolean => {
            if (id.startsWith('dues_'))          return config.feature_bills;
            if (id.startsWith('announcements_')) return config.feature_announcements;
            if (id.startsWith('maintenance_'))   return config.feature_complaints;
            if (id.startsWith('visitors_') || id === 'gate_console') return config.feature_visitors;
            return FLAG_FOR_GROUP[group] ?? true;
          };

          const rows = config.items.filter(i => flagFor(i.id, i.group));
          if (!rows.length) return null;

          return (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f8fafc' }}>Features</div>
              {rows.map(r => (
                <MenuRow key={r.id} icon={r.icon ?? '•'} label={r.label} sublabel={r.hint ?? ''}
                  onClick={() => navigate(r.path)} />
              ))}
            </div>
          );
        })()}

        <div style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', paddingBottom: 24 }}>
          SmartAppt v1.0
        </div>
      </div>
    </div>
  );
}
