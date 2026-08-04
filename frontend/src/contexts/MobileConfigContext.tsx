import { createContext, useContext, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useGetMyMobileConfigQuery, type MobileConfig } from '../store/api/systemApi';

// Safe defaults — all features on, no branding overrides
const DEFAULT_CONFIG: MobileConfig = {
  feature_bills: true,
  feature_announcements: true,
  feature_complaints: true,
  feature_visitors: true,
  feature_journal: true,
  feature_ledger: true,
  feature_pnl: true,
  feature_balance_sheet: true,
  feature_coa: true,
  feature_fy_closure: true,
  push_dues_reminder: true,
  push_announcements: true,
  push_visitor_alerts: true,
  login_mpin_enabled: true,
  login_biometric: false,
  login_otp_only: false,
  app_name: null,
  theme_color: null,
  logo_url: null,
  menu_items: null,
  menu: undefined,
};

/**
 * `menu` is resolved server-side for the signed-in role, and only enabled
 * items are sent. So membership of the list IS the permission — the app never
 * merges defaults itself, which is what keeps an out-of-date phone from
 * disagreeing with the server about who may see what.
 *
 * When `menu` is absent — an older backend, or the request has not landed yet —
 * `can()` returns true. Falling open is the right failure here: this is a menu,
 * not an authorisation boundary. Every endpoint behind these screens enforces
 * its own roles, so a briefly over-generous menu shows someone a screen that
 * will refuse them, whereas failing closed would blank the app on a slow
 * network and look broken.
 */
interface MobileConfigValue extends MobileConfig {
  can:     (itemId: string) => boolean;
  canPost: (itemId: string) => boolean;
  ready:   boolean;
}

const MobileConfigContext = createContext<MobileConfigValue>({
  ...DEFAULT_CONFIG,
  can: () => true,
  canPost: () => true,
  ready: false,
});

export function MobileConfigProvider({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.access_token);

  // Only fetch when logged in; don't block the login screen
  const { data } = useGetMyMobileConfigQuery(undefined, { skip: !token });
  const config: MobileConfig = data?.data ?? DEFAULT_CONFIG;

  const value = useMemo<MobileConfigValue>(() => {
    const menu = config.menu;
    const byId = new Map((menu ?? []).map(i => [i.id, i]));
    return {
      ...config,
      ready: menu !== undefined,
      can:     (id) => (menu === undefined ? true : byId.has(id)),
      canPost: (id) => (menu === undefined ? true : (byId.get(id)?.can_post ?? false)),
    };
  }, [config]);

  // Apply branding CSS custom properties whenever config changes
  useEffect(() => {
    if (config.theme_color) {
      document.documentElement.style.setProperty('--theme-accent', config.theme_color);
      document.documentElement.style.setProperty('--color-primary', config.theme_color);
    }
    if (config.app_name) {
      document.title = config.app_name;
    }
  }, [config.theme_color, config.app_name]);

  return (
    <MobileConfigContext.Provider value={value}>
      {children}
    </MobileConfigContext.Provider>
  );
}

export const useMobileConfig = () => useContext(MobileConfigContext);
