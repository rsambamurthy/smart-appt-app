import { baseApi } from './baseApi';

export type ModuleKey = 'ACCOUNTING' | 'GOVERNANCE';
export type ModuleAccess = 'FULL' | 'READ_ONLY' | 'NONE';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'CANCELLED';

export interface ModuleEntitlement {
  module:        ModuleKey;
  name:          string;
  access:        ModuleAccess;
  status:        SubscriptionStatus | null;
  starts_on:     string | null;
  expires_on:    string | null;
  days_left:     number | null;
  expiring_soon: boolean;
}

export type SubscriptionFilter = 'ALL' | 'EXPIRING' | 'LAPSED' | 'TRIAL' | 'UNSUBSCRIBED';

export interface AssociationSubscriptions {
  id:      string;
  name:    string;
  city:    string | null;
  modules: ModuleEntitlement[];
}

export const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // What the signed-in user's own association is entitled to. Drives menu
    // visibility and the renewal banner, so it is fetched once and cached.
    getMyEntitlements: builder.query<{ data: { modules: ModuleEntitlement[] } }, void>({
      query: () => '/subscriptions/mine',
      providesTags: ['Subscription'],
    }),

    // ── Super user ────────────────────────────────────────────────────────────
    listSubscriptions: builder.query<
      {
        data: AssociationSubscriptions[];
        meta: { page: number; limit: number; total: number; pages: number };
        summary: { active: number; trial: number; expiring: number; lapsed: number };
        trial_days: number;
      },
      { q?: string; filter?: SubscriptionFilter; page?: number; limit?: number } | void
    >({
      query: (args) => ({
        url: '/subscriptions',
        params: {
          q:      args?.q      || undefined,
          filter: args?.filter || undefined,
          page:   args?.page   ?? 1,
          limit:  args?.limit  ?? 25,
        },
      }),
      providesTags: ['Subscription'],
    }),

    listExpiring: builder.query<{ data: unknown[] }, number | void>({
      query: (days) => ({ url: '/subscriptions/expiring', params: { days: days ?? 30 } }),
      providesTags: ['Subscription'],
    }),

    grantModule: builder.mutation<{ data: unknown }, {
      associationId: string;
      module:        ModuleKey;
      status?:       SubscriptionStatus;
      starts_on?:    string;
      // Must be sent explicitly — null means perpetual. Omitting it is
      // rejected by the server, because an accidental perpetual grant is
      // indistinguishable from a deliberate one after the fact.
      expires_on:    string | null;
      amount?:       number | null;
      reference?:    string | null;
      note?:         string | null;
    }>({
      query: ({ associationId, module, ...body }) => ({
        url: `/subscriptions/${associationId}/${module}`, method: 'POST', body,
      }),
      invalidatesTags: ['Subscription'],
    }),

    cancelModule: builder.mutation<{ data: unknown }, { associationId: string; module: ModuleKey }>({
      query: ({ associationId, module }) => ({
        url: `/subscriptions/${associationId}/${module}`, method: 'DELETE',
      }),
      invalidatesTags: ['Subscription'],
    }),
  }),
});

export const {
  useGetMyEntitlementsQuery,
  useListSubscriptionsQuery,
  useListExpiringQuery,
  useGrantModuleMutation,
  useCancelModuleMutation,
} = subscriptionsApi;
