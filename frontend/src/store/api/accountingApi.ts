import { baseApi } from './baseApi';

// ── Account types ─────────────────────────────────────────────────────────────
export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

export interface Account {
  id:          string;
  code:        string;
  name:        string;
  type:        AccountType;
  sub_type:    string | null;
  description: string | null;
  is_system:   boolean;
  is_active:   boolean;
  sort_order:  number;
  created_at:  string;
}

// ── Journal types ─────────────────────────────────────────────────────────────
export interface JournalLine {
  id:         string;
  account_id: string;
  debit:      number;
  credit:     number;
  narration:  string | null;
  account:    { code: string; name: string; type: string };
}

export interface JournalEntry {
  id:             string;
  entry_date:     string;
  narration:      string;
  reference_type: string | null;
  reference_id:   string | null;
  type:           'AUTO' | 'MANUAL';
  created_by:     string | null;
  created_at:     string;
  lines:          JournalLine[];
}

export interface JournalLineInput {
  account_id: string;
  debit:      number;
  credit:     number;
  narration?: string;
}

// ── Combined API ──────────────────────────────────────────────────────────────
const accountingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // Chart of Accounts
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

    // Journal Entries
    listJournalEntries: builder.query<{ data: JournalEntry[]; nextCursor: string | null }, { type?: string; from?: string; to?: string; cursor?: string }>({
      query: (params) => {
        const q = new URLSearchParams();
        if (params.type)   q.set('type',   params.type);
        if (params.from)   q.set('from',   params.from);
        if (params.to)     q.set('to',     params.to);
        if (params.cursor) q.set('cursor', params.cursor);
        return `/accounting/journal?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),
    createJournalEntry: builder.mutation<{ data: JournalEntry }, { entry_date: string; narration: string; lines: JournalLineInput[] }>({
      query: (body) => ({ url: '/accounting/journal', method: 'POST', body }),
      invalidatesTags: ['Journal'],
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
  useListJournalEntriesQuery,
  useCreateJournalEntryMutation,
} = accountingApi;
