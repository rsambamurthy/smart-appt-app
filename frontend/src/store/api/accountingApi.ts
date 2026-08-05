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
  // Supporting document. The bytes are never sent with the entry — presence of
  // file_name is what tells the UI there is something to download.
  file_name?:     string | null;
  mime_type?:     string | null;
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
  previous?:               BsPrevious | null;
  schedules?:              BsSchedule[];
}

export interface TrialBalanceRow {
  id:            string;
  code:          string;
  name:          string;
  type:          string;
  sub_type:      string | null;
  totalDebit:    number;
  totalCredit:   number;
  debitBalance:  number;
  creditBalance: number;
}

export interface TrialBalanceResult {
  asOf:               string;
  from:               string | null;
  accounts:           TrialBalanceRow[];
  totalDebit:         number;
  totalCredit:        number;
  totalDebitBalance:  number;
  totalCreditBalance: number;
  isBalanced:         boolean;
  difference:         number;
  warnings:           string[];
}

export interface DayBookLine {
  account_code: string;
  account_name: string;
  bp_code:      string | null;
  bp_name:      string | null;
  narration:    string | null;
  debit:        number;
  credit:       number;
}

export interface DayBookEntry {
  id:             string;
  reference_code: string;
  voucher_type:   string;
  narration:      string;
  source:         string;
  reference_type: string | null;
  totalDebit:     number;
  lines:          DayBookLine[];
}

export interface DayBookResult {
  period:     { from: string; to: string };
  days:       { date: string; entries: DayBookEntry[]; totalDebit: number }[];
  entryCount: number;
  grandTotal: number;
}

export interface CashBookRow {
  id:             string;
  entry_id:       string;
  date:           string;
  reference_code: string;
  voucher_type:   string;
  narration:      string;
  particulars:    string;
  bp_name:        string | null;
  receipt:        number;
  payment:        number;
  balance:        number;
}

export interface CashBookResult {
  account:        { id: string; code: string; name: string };
  kind:           'CASH' | 'BANK';
  period:         { from: string; to: string };
  openingBalance: number;
  rows:           CashBookRow[];
  totalReceipts:  number;
  totalPayments:  number;
  closingBalance: number;
}

export interface IERow {
  id:       string;
  code:     string;
  name:     string;
  sub_type: string | null;
  amount:   number;
}

export interface IEGroup {
  label: string;
  rows:  IERow[];
  total: number;
}

export interface IEPeriod {
  period:            { from: string; to: string };
  income:            IERow[];
  expenditure:       IERow[];
  incomeGroups:      IEGroup[];
  expenditureGroups: IEGroup[];
  totalIncome:       number;
  totalExpenditure:  number;
  surplus:           number;
}

export type IncomeExpenditureResult = IEPeriod & { previous: IEPeriod | null };

export interface BsPrevious {
  asOf:                      string;
  totalAssets:               number;
  totalLiabilities:          number;
  totalEquity:               number;
  netSurplus:                number;
  totalLiabilitiesAndEquity: number;
  byAccount:                 Record<string, number>;
}

export interface BsSchedule {
  account: { code: string; name: string };
  total:   number;
  rows:    { code: string; name: string; amount: number }[];
}

export interface RPBalance {
  code:   string;
  name:   string;
  amount: number;
}

export interface RPRow {
  code:   string;
  name:   string;
  type:   string;
  amount: number;
}

export interface ReceiptsPaymentsResult {
  period:                { from: string; to: string };
  cashAccounts:          { code: string; name: string }[];
  openingBalances:       RPBalance[];
  openingTotal:          number;
  receipts:              RPRow[];
  totalReceipts:         number;
  payments:              RPRow[];
  totalPayments:         number;
  closingBalances:       RPBalance[];
  closingTotal:          number;
  totalLeft:             number;
  totalRight:            number;
  isReconciled:          boolean;
  difference:            number;
  contraEntriesExcluded: number;
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

// ── Financial Year ────────────────────────────────────────────────────────────
export interface FYStatus {
  financial_year: string;
  is_current:     boolean;
  is_closed:      boolean;
  status:         'OPEN' | 'CLOSED' | 'REOPENED';
  net_surplus:    number | null;
  closed_at:      string | null;
  closed_by:      string | null;
  closing_entry_id: string | null;
}

export interface FYListResult {
  data:           FYStatus[];
  current_fy:     string;
  fy_start_month: number;
}

export interface FYPreviewLine {
  account: { id: string; code: string; name: string; type: string; sub_type: string | null };
  balance: number;
}

export interface FYPreviewResult {
  financial_year:  string;
  total_income:    number;
  total_expense:   number;
  net_surplus:     number;
  income_lines:    FYPreviewLine[];
  expense_lines:   FYPreviewLine[];
  equity_accounts: { id: string; code: string; name: string }[];
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
  upi_vpa:               string | null;
  upi_payee_name:        string | null;
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
    createJournalEntry: builder.mutation<{ data: JournalEntry }, { entry_date: string; narration: string; voucher_type?: 'BV' | 'CV' | 'JV'; lines: JournalLineInput[] }>({
      query: (body) => ({ url: '/accounting/journal', method: 'POST', body }),
      invalidatesTags: ['Journal'],
    }),
    updateJournalEntry: builder.mutation<{ data: JournalEntry }, { id: string; entry_date: string; narration: string; voucher_type?: 'BV' | 'CV' | 'JV'; lines: JournalLineInput[] }>({
      query: ({ id, ...body }) => ({ url: `/accounting/journal/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Journal'],
    }),
    uploadJournalAttachment: builder.mutation<{ data: { file_name: string; mime_type: string; size: number } }, { id: string; file: File }>({
      query: ({ id, file }) => {
        const form = new FormData();
        form.append('file', file);
        return { url: `/accounting/journal/${id}/attachment`, method: 'POST', body: form };
      },
      invalidatesTags: ['Journal'],
    }),
    deleteJournalAttachment: builder.mutation<{ data: { removed: boolean } }, { id: string }>({
      query: ({ id }) => ({ url: `/accounting/journal/${id}/attachment`, method: 'DELETE' }),
      invalidatesTags: ['Journal'],
    }),
    // Fetched as a blob so the browser download carries the auth header.
    downloadJournalAttachment: builder.mutation<Blob, { id: string }>({
      query: ({ id }) => ({
        url: `/accounting/journal/${id}/attachment`,
        method: 'GET',
        responseHandler: (response: Response) => response.blob(),
      }),
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

    // Financial Year
    getFYConfig: builder.query<{ data: { financial_year_start_month: number } }, void>({
      query: () => '/accounting/fy/config',
      providesTags: ['Journal'],
    }),
    updateFYConfig: builder.mutation<{ data: { financial_year_start_month: number } }, { financial_year_start_month: number }>({
      query: (body) => ({ url: '/accounting/fy/config', method: 'PATCH', body }),
      invalidatesTags: ['Journal'],
    }),
    listFYs: builder.query<FYListResult, void>({
      query: () => '/accounting/fy/list',
      providesTags: ['Journal'],
    }),
    previewFYClosure: builder.query<{ data: FYPreviewResult }, { fy: string }>({
      query: ({ fy }) => `/accounting/fy/preview?fy=${encodeURIComponent(fy)}`,
      providesTags: ['Journal'],
    }),
    closeFY: builder.mutation<{ data: { financial_year: string; net_surplus: number; closing_entry_id: string | null } }, { fy: string; surplus_account_id: string; notes?: string }>({
      query: (body) => ({ url: '/accounting/fy/close', method: 'POST', body }),
      invalidatesTags: ['Journal'],
    }),
    reopenFY: builder.mutation<{ data: { financial_year: string; status: string } }, { fy: string }>({
      query: (body) => ({ url: '/accounting/fy/reopen', method: 'POST', body }),
      invalidatesTags: ['Journal'],
    }),
    getBalanceSheet: builder.query<{ data: BalanceSheetResult }, { asOf: string; compare?: boolean; schedules?: boolean }>({
      query: ({ asOf, compare, schedules }) => {
        const q = new URLSearchParams({ asOf });
        if (compare)   q.set('compare',   'true');
        if (schedules) q.set('schedules', 'true');
        return `/accounting/journal/balance-sheet?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),
    getIncomeExpenditure: builder.query<{ data: IncomeExpenditureResult }, { from: string; to: string; compare?: boolean }>({
      query: ({ from, to, compare }) => {
        const q = new URLSearchParams({ from, to });
        if (compare) q.set('compare', 'true');
        return `/accounting/journal/income-expenditure?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),
    getTrialBalance: builder.query<{ data: TrialBalanceResult }, { asOf: string; from?: string }>({
      query: ({ asOf, from }) => {
        const q = new URLSearchParams({ asOf });
        if (from) q.set('from', from);
        return `/accounting/journal/trial-balance?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),
    getReceiptsPayments: builder.query<{ data: ReceiptsPaymentsResult }, { from: string; to: string; cash_codes?: string }>({
      query: ({ from, to, cash_codes }) => {
        const q = new URLSearchParams({ from, to });
        if (cash_codes) q.set('cash_codes', cash_codes);
        return `/accounting/journal/receipts-payments?${q.toString()}`;
      },
      providesTags: ['Journal'],
    }),
    getDayBook: builder.query<{ data: DayBookResult }, { from: string; to: string }>({
      query: ({ from, to }) => `/accounting/journal/day-book?from=${from}&to=${to}`,
      providesTags: ['Journal'],
    }),
    getCashBook: builder.query<{ data: CashBookResult }, { kind: 'CASH' | 'BANK'; from: string; to: string; account_id?: string }>({
      query: ({ kind, from, to, account_id }) => {
        const q = new URLSearchParams({ kind, from, to });
        if (account_id) q.set('account_id', account_id);
        return `/accounting/journal/cash-book?${q.toString()}`;
      },
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
  useUploadJournalAttachmentMutation,
  useDeleteJournalAttachmentMutation,
  useDownloadJournalAttachmentMutation,
  useBackfillTransactionsMutation,
  useBackfillBPTagsMutation,
  useGetFYConfigQuery,
  useUpdateFYConfigMutation,
  useListFYsQuery,
  usePreviewFYClosureQuery,
  useCloseFYMutation,
  useReopenFYMutation,
  useGetBalanceSheetQuery,
  useGetTrialBalanceQuery,
  useGetReceiptsPaymentsQuery,
  useGetIncomeExpenditureQuery,
  useGetDayBookQuery,
  useGetCashBookQuery,
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
