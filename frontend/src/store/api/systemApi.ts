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

// ── Audit trail ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  association_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  performed_by: string | null;
  actor_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  summary: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  performer?: { id: string; name: string; phone: string; role: string } | null;
  association?: { id: string; name: string } | null;
}

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  performed_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  association_id?: string;
  cursor?: string;
  limit?: number;
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

    // ── Audit trail (read-only) ───────────────────────────────────────────────
    listAuditLogs: builder.query<
      { data: AuditLogEntry[]; meta: { next_cursor: string | null; count: number } },
      AuditLogFilters
    >({
      query: (filters) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
        });
        return `/system/audit-logs?${params.toString()}`;
      },
    }),
    getAuditFacets: builder.query<
      { data: { entity_types: string[]; actions: string[] } },
      string | void
    >({
      query: (associationId) =>
        `/system/audit-logs/facets${associationId ? `?association_id=${associationId}` : ''}`,
    }),
  }),
});

export const {
  useGetMenuConfigQuery,
  useSaveMenuConfigMutation,
  useGetMyMobileConfigQuery,
  useGetMobileConfigQuery,
  useSaveMobileConfigMutation,
  useListAuditLogsQuery,
  useGetAuditFacetsQuery,
} = systemApi;
