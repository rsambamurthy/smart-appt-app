import { baseApi } from './baseApi';

// ── Account types ─────────────────────────────────────────────────────────────
export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

export type BalanceType = 'DEBIT' | 'CREDIT';

export interface Account {
  id:                   string;
  code:                 string;
  name:                 string;
  type:                 AccountType;
  sub_type:             string | null;
  description:          string | null;
  is_system:            boolean;
  is_active:            boolean;
  is_group:             boolean;
  is_control_account:   boolean;
  bp_type_id:           string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  sort_order:           number;
  created_at:           string;
}

// ── Journal types ─────────────────────────────────────────────────────────────
export interface JournalLine {
  id:                   string;
  account_id:           string;
  business_partner_id:  string | null;
  debit:                number;
  credit:               number;
  narration:            string | null;
  account:              { code: string; name: string; type: string };
  business_partner:     { id: string; code: string; name: string } | null;
}

export interface JournalEntry {
  id:             string;
  entry_date:     string;
  narration:      string;
  reference_type: string | null;
  reference_id:   string | null;
  reference_code: string | null;
  voucher_type:   string | null;
  type:           'AUTO' | 'MANUAL';
  created_by:     string | null;
  created_at:     string;
  lines:          JournalLine[];
}

export interface JournalLineInput {
  account_id:          string;
  business_partner_id?: string | null;
  debit:               number;
  credit:              number;
  narration?:          string;
}

export interface LedgerRow {
  id:               string;
  entry_date:       string;
  narration:        string;
  reference_type:   string | null;
  reference_code:   string | null;
  voucher_type:     string | null;
  source:           string;
  business_partner: { id: string; name: string; code: string } | null;
  debit:            number;
  credit:           number;
  balance:          number;
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
  baseOB:         number;
  openingBalance: number;
  closingBalance: number;
  rows:           LedgerRow[];
}

export interface SubLedgerBP {
  bp:             { id: string; name: string; code: string };
  baseOB:         number;
  openingBalance: number;
  closingBalance: number;
  rows:           Omit<LedgerRow, 'business_partner'>[];
}

export interface SubLedgerResult {
  account:       { id: string; code: string; name: string; type: string; sub_type: string | null };
  isDebitNormal: boolean;
  bps:           SubLedgerBP[];
}

// ── BP Types ──────────────────────────────────────────────────────────────────
export type BPSide     = 'RECEIVABLE' | 'PAYABLE' | 'BOTH';
export type BPCategory = 'BANK' | 'VENDOR' | 'UNIT';

// ── Unit Opening Balance ──────────────────────────────────────────────────────
export interface UnitWithBalance {
  unit_id:              string;
  flat_number:          string;
  block:                string | null;
  floor:                number;
  unit_type:            string | null;
  owner_name:           string | null;
  bp_id:                string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
}

export interface UnitOBPreviewRow {
  unit_id:              string;
  flat_number:          string;
  block:                string | null;
  status:               'create' | 'update' | 'skip' | 'error';
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  error?:               string;
}

export interface BPType {
  id:             string;
  name:           string;
  side:           BPSide;
  is_active:      boolean;
  association_id: string;
  created_at:     string;
}

// ── Bank Bulk Upload ──────────────────────────────────────────────────────────
export interface BankUploadPreviewRow {
  row_num:              number;
  code:                 string;
  name:                 string;
  phone:                string | null;
  email:                string | null;
  account_number:       string | null;
  ifsc:                 string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  status:               'create' | 'update' | 'skip' | 'error';
  error?:               string;
}

// ── Vendor Bulk Upload ────────────────────────────────────────────────────────
export interface VendorUploadPreviewRow {
  row_num:              number;
  code:                 string;
  name:                 string;
  phone:                string | null;
  email:                string | null;
  gstin:                string | null;
  pan:                  string | null;
  service_type_name:    string | null;
  service_type_id:      string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  status:               'create' | 'update' | 'skip' | 'error';
  error?:               string;
}

// ── Vendor Service Type Master ─────────────────────────────────────────────────
export interface ServiceType {
  id:             string;
  name:           string;
  description:    string | null;
  is_active:      boolean;
  association_id: string;
  created_at:     string;
  updated_at:     string;
}

// ── Business Partner Master ───────────────────────────────────────────────────
export interface UnitRef {
  id:          string;
  flat_number: string;
  block:       string | null;
}

export interface BusinessPartner {
  id:                    string;
  code:                  string;
  name:                  string;
  bp_category:           BPCategory;
  bp_type_id:            string | null;
  bp_type:               { id: string; name: string; side: BPSide } | null;
  // bank
  account_number:        string | null;
  ifsc:                  string | null;
  // vendor
  gstin:                 string | null;
  pan:                   string | null;
  service_type_id:       string | null;
  service_type:          { id: string; name: string } | null;
  // unit
  unit_id:               string | null;
  unit:                  UnitRef | null;
  // contact
  email:                 string | null;
  phone:                 string | null;
  // opening balance
  opening_balance:       number | null;
  opening_balance_type:  BalanceType | null;
  opening_balance_date:  string | null;
  is_active:             boolean;
  created_at:            string;
}

export interface UnitOption {
  id:          string;
  flat_number: string;
  block:       string | null;
  floor:       number;
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

    // BP Types
    listBPTypes: builder.query<{ data: BPType[] }, void>({
      query: () => '/accounting/bp-types',
      providesTags: ['Account'],
    }),
    createBPType: builder.mutation<{ data: BPType }, { name: string; side: BPSide }>({
      query: (body) => ({ url: '/accounting/bp-types', method: 'POST', body }),
      invalidatesTags: ['Account'],
    }),
    toggleBPType: builder.mutation<{ data: BPType }, string>({
      query: (id) => ({ url: `/accounting/bp-types/${id}/toggle`, method: 'PATCH' }),
      invalidatesTags: ['Account'],
    }),

    // BP Master
    listBPMasters: builder.query<{ data: BusinessPartner[] }, { category?: BPCategory }>({
      query: ({ category } = {}) => `/accounting/bp-masters${category ? `?category=${category}` : ''}`,
      providesTags: ['BPMaster'],
    }),
    createBPMaster: builder.mutation<{ data: BusinessPartner }, Partial<BusinessPartner>>({
      query: (body) => ({ url: '/accounting/bp-masters', method: 'POST', body }),
      invalidatesTags: ['BPMaster'],
    }),
    updateBPMaster: builder.mutation<{ data: BusinessPartner }, { id: string; body: Partial<BusinessPartner> }>({
      query: ({ id, body }) => ({ url: `/accounting/bp-masters/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['BPMaster'],
    }),
    toggleBPMaster: builder.mutation<{ data: BusinessPartner }, string>({
      query: (id) => ({ url: `/accounting/bp-masters/${id}/toggle`, method: 'PATCH' }),
      invalidatesTags: ['BPMaster'],
    }),
    deleteBPMaster: builder.mutation<{ data: { deleted: boolean } }, string>({
      query: (id) => ({ url: `/accounting/bp-masters/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BPMaster'],
    }),
    listUnitOptions: builder.query<{ data: UnitOption[] }, void>({
      query: () => '/accounting/bp-masters/units',
      providesTags: ['BPMaster'],
    }),
    listUnitsWithBalances: builder.query<{ data: UnitWithBalance[] }, void>({
      query: () => '/accounting/bp-masters/units/with-balances',
      providesTags: ['BPMaster'],
    }),
    applyUnitOBUpload: builder.mutation<{ data: { created: number; updated: number } }, UnitOBPreviewRow[]>({
      query: (rows) => ({ url: '/accounting/bp-masters/units/upload/apply', method: 'POST', body: { rows } }),
      invalidatesTags: ['BPMaster'],
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
    backfillBPTags: builder.mutation<{ data: { tagged: number } }, void>({
      query: () => ({ url: '/accounting/journal/backfill-bp-tags', method: 'POST' }),
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
    getAllLedger: builder.query<{ data: LedgerResult[] }, { from?: string; to?: string }>({
      query: ({ from, to }) => {
        const q = new URLSearchParams();
        if (from) q.set('from', from);
        if (to)   q.set('to',   to);
        return `/accounting/journal/ledger/all?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),
    getSubLedger: builder.query<{ data: SubLedgerResult }, { account_id: string; from?: string; to?: string }>({
      query: ({ account_id, from, to }) => {
        const q = new URLSearchParams({ account_id });
        if (from) q.set('from', from);
        if (to)   q.set('to',   to);
        return `/accounting/journal/ledger/sub?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),

    // Service Types
    listServiceTypes: builder.query<{ data: ServiceType[] }, void>({
      query: () => '/accounting/service-types',
      providesTags: ['ServiceType'],
    }),
    createServiceType: builder.mutation<{ data: ServiceType }, { name: string; description?: string | null }>({
      query: (body) => ({ url: '/accounting/service-types', method: 'POST', body }),
      invalidatesTags: ['ServiceType'],
    }),
    updateServiceType: builder.mutation<{ data: ServiceType }, { id: string; name?: string; description?: string | null }>({
      query: ({ id, ...body }) => ({ url: `/accounting/service-types/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['ServiceType'],
    }),
    toggleServiceType: builder.mutation<{ data: ServiceType }, string>({
      query: (id) => ({ url: `/accounting/service-types/${id}/toggle`, method: 'PATCH' }),
      invalidatesTags: ['ServiceType'],
    }),
    deleteServiceType: builder.mutation<{ data: { deleted: boolean } }, string>({
      query: (id) => ({ url: `/accounting/service-types/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ServiceType'],
    }),

    // Vendor Bulk Upload
    previewVendorUpload: builder.mutation<{ data: VendorUploadPreviewRow[] }, FormData>({
      query: (formData) => ({ url: '/accounting/vendors/upload/preview', method: 'POST', body: formData }),
    }),
    applyVendorUpload: builder.mutation<{ data: { created: number; updated: number } }, VendorUploadPreviewRow[]>({
      query: (rows) => ({ url: '/accounting/vendors/upload/apply', method: 'POST', body: { rows } }),
      invalidatesTags: ['BPMaster'],
    }),

    // Bank Bulk Upload
    previewBankUpload: builder.mutation<{ data: BankUploadPreviewRow[] }, FormData>({
      query: (formData) => ({ url: '/accounting/banks/upload/preview', method: 'POST', body: formData }),
    }),
    applyBankUpload: builder.mutation<{ data: { created: number; updated: number } }, BankUploadPreviewRow[]>({
      query: (rows) => ({ url: '/accounting/banks/upload/apply', method: 'POST', body: { rows } }),
      invalidatesTags: ['BPMaster'],
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
  useListBPTypesQuery,
  useCreateBPTypeMutation,
  useToggleBPTypeMutation,
  useListBPMastersQuery,
  useCreateBPMasterMutation,
  useUpdateBPMasterMutation,
  useToggleBPMasterMutation,
  useDeleteBPMasterMutation,
  useListUnitOptionsQuery,
  useListUnitsWithBalancesQuery,
  useApplyUnitOBUploadMutation,
  useListJournalEntriesQuery,
  useCreateJournalEntryMutation,
  useUpdateJournalEntryMutation,
  useBackfillTransactionsMutation,
  useBackfillBPTagsMutation,
  useGetBalanceSheetQuery,
  useGetLedgerQuery,
  useGetAllLedgerQuery,
  useGetSubLedgerQuery,
  useGetPnLQuery,
  useListServiceTypesQuery,
  useCreateServiceTypeMutation,
  useUpdateServiceTypeMutation,
  useToggleServiceTypeMutation,
  useDeleteServiceTypeMutation,
  usePreviewVendorUploadMutation,
  useApplyVendorUploadMutation,
  usePreviewBankUploadMutation,
  useApplyBankUploadMutation,
} = accountingApi;
