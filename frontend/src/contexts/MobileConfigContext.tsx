import { createContext, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useGetMyMobileConfigQuery, type MobileConfig } from '../store/api/systemApi';

// Safe defaults — all features on, no branding overrides
const DEFAULT_CONFIG: MobileConfig = {
  feature_bills: true,
  feature_announcements: true,
  feature_complaints: true,
  feature_visitors: true,
  push_dues_reminder: true,
  push_announcements: true,
  push_visitor_alerts: true,
  login_mpin_enabled: true,
  login_biometric: false,
  login_otp_only: false,
  app_name: null,
  theme_color: null,
  logo_url: null,
};

const MobileConfigContext = createContext<MobileConfig>(DEFAULT_CONFIG);

export function MobileConfigProvider({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.access_token);

  // Only fetch when logged in; don't block the login screen
  const { data } = useGetMyMobileConfigQuery(undefined, { skip: !token });
  const config: MobileConfig = data?.data ?? DEFAULT_CONFIG;

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
    <MobileConfigContext.Provider value={config}>
      {children}
    </MobileConfigContext.Provider>
  );
}

export const useMobileConfig = () => useContext(MobileConfigContext);
