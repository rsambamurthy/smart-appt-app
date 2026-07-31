import { baseApi } from './baseApi';

export type MenuConfig = Record<string, Record<string, boolean>>;

export interface MenuItemConfig {
  enabled: boolean;
  can_post: boolean;
}
export type MenuItemsMap = Record<string, MenuItemConfig>;

export interface MobileConfig {
  association_id?: string;
  feature_bills: boolean;
  feature_announcements: boolean;
  feature_complaints: boolean;
  feature_visitors: boolean;
  // Accounting feature flags (Gold mobile)
  feature_journal: boolean;
  feature_ledger: boolean;
  feature_pnl: boolean;
  feature_balance_sheet: boolean;
  feature_coa: boolean;
  feature_fy_closure: boolean;
  push_dues_reminder: boolean;
  push_announcements: boolean;
  push_visitor_alerts: boolean;
  login_mpin_enabled: boolean;
  login_biometric: boolean;
  login_otp_only: boolean;
  app_name: string | null;
  theme_color: string | null;
  logo_url: string | null;
  /** Per-menu-item visibility and post permission for the mobile app */
  menu_items: MenuItemsMap | null;
}

export const systemApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMenuConfig: builder.query<{ data: MenuConfig }, void>({
      query: () => '/system/menu-config',
      providesTags: ['MenuConfig'],
    }),
    saveMenuConfig: builder.mutation<{ data: MenuConfig }, Array<{ group_id: string; role: string; enabled: boolean }>>({
      query: (body) => ({ url: '/system/menu-config', method: 'PUT', body }),
      invalidatesTags: ['MenuConfig'],
    }),
    // Mobile app: get own association's config
    getMyMobileConfig: builder.query<{ data: MobileConfig }, void>({
      query: () => '/system/mobile-config',
      providesTags: ['MobileConfig'],
    }),
    // SUPER_USER admin: get config for a specific association
    getMobileConfig: builder.query<{ data: MobileConfig }, string>({
      query: (associationId) => `/system/mobile-config/${associationId}`,
      providesTags: (_r, _e, id) => [{ type: 'MobileConfig', id }],
    }),
    // SUPER_USER admin: save config for a specific association
    saveMobileConfig: builder.mutation<{ data: MobileConfig }, { associationId: string; body: Partial<MobileConfig> }>({
      query: ({ associationId, body }) => ({ url: `/system/mobile-config/${associationId}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { associationId }) => [{ type: 'MobileConfig', id: associationId }, 'MobileConfig'],
    }),
  }),
});

export const {
  useGetMenuConfigQuery,
  useSaveMenuConfigMutation,
  useGetMyMobileConfigQuery,
  useGetMobileConfigQuery,
  useSaveMobileConfigMutation,
} = systemApi;
