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

export interface LedgerRow {
  id:             string;
  entry_date:     string;
  narration:      string;
  reference_type: string | null;
  entry_type:     'AUTO' | 'MANUAL';
  debit:          number;
  credit:         number;
  balance:        number;
}

export interface PnLRow {
  id:       string;
  code:     string;
  name:     string;
  sub_type: string | null;
  amount:   number;
}

export interface PnLResult {
  period:       { from: string; to: string };
  income:       PnLRow[];
  expense:      PnLRow[];
  totalIncome:  number;
  totalExpense: number;
  netSurplus:   number;
}

export interface BackfillCount { posted: number; skipped: number; failed: number }
export interface BackfillResult {
  bills:    BackfillCount;
  payments: BackfillCount;
  expenses: BackfillCount;
  receipts: BackfillCount;
}

export interface BsRow {
  id:       string;
  code:     string;
  name:     string;
  sub_type: string | null;
  amount:   number;
}

export interface BalanceSheetResult {
  asOf:                    string;
  assets:                  BsRow[];
  liabilities:             BsRow[];
  equity:                  BsRow[];
  netSurplus:              number;
  totalAssets:             number;
  totalLiabilities:        number;
  totalEquity:             number;
  totalLiabilitiesAndEquity: number;
}

export interface LedgerResult {
  account:        { id: string; code: string; name: string; type: string; sub_type: string | null };
  isDebitNormal:  boolean;
  openingBalance: number;
  closingBalance: number;
  rows:           LedgerRow[];
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
    updateJournalEntry: builder.mutation<{ data: JournalEntry }, { id: string; entry_date: string; narration: string; lines: JournalLineInput[] }>({
      query: ({ id, ...body }) => ({ url: `/accounting/journal/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Journal'],
    }),
    getPnL: builder.query<{ data: PnLResult }, { from: string; to: string }>({
      query: ({ from, to }) => `/accounting/journal/pnl?from=${from}&to=${to}`,
      providesTags: ['Journal'],
    }),
    backfillTransactions: builder.mutation<{ data: BackfillResult }, void>({
      query: () => ({ url: '/accounting/journal/backfill', method: 'POST' }),
      invalidatesTags: ['Journal'],
    }),
    getBalanceSheet: builder.query<{ data: BalanceSheetResult }, { asOf: string }>({
      query: ({ asOf }) => `/accounting/journal/balance-sheet?asOf=${asOf}`,
      providesTags: ['Journal'],
    }),
    getLedger: builder.query<{ data: LedgerResult }, { account_id: string; from?: string; to?: string }>({
      query: ({ account_id, from, to }) => {
        const q = new URLSearchParams({ account_id });
        if (from) q.set('from', from);
        if (to)   q.set('to',   to);
        return `/accounting/journal/ledger?${q.toString()}`;
      },
      providesTags: ['Journal'],
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
  useUpdateJournalEntryMutation,
  useBackfillTransactionsMutation,
  useGetBalanceSheetQuery,
  useGetLedgerQuery,
  useGetPnLQuery,
} = accountingApi;
