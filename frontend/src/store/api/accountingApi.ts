import { baseApi } from './baseApi';

export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  sub_type: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const accountingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listAccounts: builder.query<{ data: Account[] }, void>({
      query: () => '/accounting/accounts',
      providesTags: ['Account'],
    }),
    seedAccounts: builder.mutation<{ data: { seeded: number } }, void>({
      query: () => ({ url: '/accounting/accounts/seed', method: 'POST' }),
      invalidatesTags: ['Account'],
    }),
    createAccount: builder.mutation<{ data: Account }, Partial<Account>>({
      query: (body) => ({ url: '/accounting/accounts', method: 'POST', body }),
      invalidatesTags: ['Account'],
    }),
    updateAccount: builder.mutation<{ data: Account }, { id: string; body: Partial<Account> }>({
      query: ({ id, body }) => ({ url: `/accounting/accounts/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Account'],
    }),
    toggleAccount: builder.mutation<{ data: Account }, string>({
      query: (id) => ({ url: `/accounting/accounts/${id}/toggle`, method: 'PATCH' }),
      invalidatesTags: ['Account'],
    }),
    deleteAccount: builder.mutation<{ data: { deleted: boolean } }, string>({
      query: (id) => ({ url: `/accounting/accounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Account'],
    }),
  }),
});

export const {
  useListAccountsQuery,
  useSeedAccountsMutation,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useToggleAccountMutation,
  useDeleteAccountMutation,
} = accountingApi;
