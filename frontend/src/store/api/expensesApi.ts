import { baseApi } from './baseApi';

export type RecurringExpenseFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

export interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  frequency: RecurringExpenseFrequency;
  next_due_date: string;
  reminder_days: number;
  is_active: boolean;
  auto_provision: boolean;
  // When false, the nightly poller skips this item once due — a Treasurer
  // must click "Post Now" each cycle instead of it happening automatically.
  auto_post: boolean;
  // Display only — the underlying Vendor bridge row's name (which mirrors the
  // Business Partner's name at the time it was picked). Selecting a vendor
  // always goes through `business_partner_id`, never this.
  vendor?: { name: string } | null;
}

export interface RecurringExpenseInput {
  description: string;
  category: string;
  // The vendor, picked from Business Partners (Configuration → Business
  // Partners, category VENDOR) — the one vendor list associations maintain.
  business_partner_id?: string;
  amount: number;
  frequency: RecurringExpenseFrequency;
  next_due_date: string;
  reminder_days?: number;
  auto_provision?: boolean;
  auto_post?: boolean;
}

export type ProvisionStatus = 'OPEN' | 'SETTLED' | 'REVERSED';

export interface ExpenseProvision {
  id: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: ProvisionStatus;
  settled_at?: string | null;
  recurring_expense: { description: string; category: string; frequency: RecurringExpenseFrequency };
}

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Category Config ──────────────────────────────────────────────────────
    listExpenseCategories: builder.query<{ data: unknown[] }, void>({
      query: () => '/expenses/categories',
      providesTags: ['Expense'],
    }),
    createExpenseCategory: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/expenses/categories', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    updateExpenseCategory: builder.mutation<{ data: unknown }, { id: string; body: object }>({
      query: ({ id, body }) => ({ url: `/expenses/categories/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Expense'],
    }),
    deleteExpenseCategory: builder.mutation<{ data: unknown }, string>({
      query: (id) => ({ url: `/expenses/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Expense'],
    }),

    // ── Expenses CRUD ────────────────────────────────────────────────────────
    listExpenses: builder.query<{ data: unknown[]; meta: object }, object>({
      query: (params) => ({ url: '/expenses', params }),
      providesTags: ['Expense'],
    }),
    getExpense: builder.query<{ data: unknown }, string>({
      query: (id) => `/expenses/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Expense' as const, id }],
    }),
    createExpense: builder.mutation<{ data: unknown }, FormData | object>({
      query: (body) => ({ url: '/expenses', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    updateExpense: builder.mutation<{ data: unknown }, { id: string; body: object }>({
      query: ({ id, body }) => ({ url: `/expenses/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Expense'],
    }),
    // reason is optional and only meaningful when the expense being deleted
    // was already posted — the server cancels its journal entry alongside
    // the delete in that case, and records this as the cancellation reason.
    deleteExpense: builder.mutation<{ data: { message: string } }, string | { id: string; reason?: string }>({
      query: (arg) => {
        const { id, reason } = typeof arg === 'string' ? { id: arg, reason: undefined } : arg;
        return { url: `/expenses/${id}`, method: 'DELETE', body: reason ? { reason } : undefined };
      },
      invalidatesTags: ['Expense'],
    }),
    approveExpense: builder.mutation<{ data: unknown }, { id: string; body: object }>({
      query: ({ id, body }) => ({ url: `/expenses/${id}/approve`, method: 'PATCH', body }),
      invalidatesTags: ['Expense'],
    }),

    // ── Dashboard / Reporting ────────────────────────────────────────────────
    getExpenseDashboard: builder.query<{ data: unknown }, void>({
      query: () => '/expenses/dashboard',
      providesTags: ['Expense'],
    }),
    getExpensesTotal: builder.query<{ data: { total_expenses: number; month_expenses: number } }, void>({
      query: () => '/expenses/total',
      providesTags: ['Expense'],
    }),
    getTransparency: builder.query<{ data: unknown[] }, void>({
      query: () => '/expenses/transparency',
    }),
    setBudget: builder.mutation<{ data: unknown }, { category: string; body: object }>({
      query: ({ category, body }) => ({ url: `/expenses/budgets/${category}`, method: 'PUT', body }),
      invalidatesTags: ['Expense'],
    }),
    listRecurring: builder.query<{ data: RecurringExpense[] }, void>({
      query: () => '/expenses/recurring',
      providesTags: ['Expense'],
    }),
    createRecurring: builder.mutation<{ data: RecurringExpense }, RecurringExpenseInput>({
      query: (body) => ({ url: '/expenses/recurring', method: 'POST', body }),
      invalidatesTags: ['Expense'],
    }),
    updateRecurring: builder.mutation<{ data: RecurringExpense }, { id: string; body: Partial<RecurringExpenseInput> & { is_active?: boolean } }>({
      query: ({ id, body }) => ({ url: `/expenses/recurring/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Expense'],
    }),
    // Create today's draft expense on demand, instead of waiting for the nightly poller to reach next_due_date.
    postRecurringNow: builder.mutation<{ data: unknown }, string>({
      query: (id) => ({ url: `/expenses/recurring/${id}/post-now`, method: 'POST' }),
      invalidatesTags: ['Expense'],
    }),

    // ── Month-end provisions ────────────────────────────────────────────────
    listProvisions: builder.query<{ data: ExpenseProvision[] }, { status?: ProvisionStatus } | void>({
      query: (params) => ({ url: '/expenses/provisions', params: params ?? {} }),
      providesTags: ['Expense'],
    }),

  }),
});

export const {
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
  useListExpensesQuery,
  useGetExpenseQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useApproveExpenseMutation,
  useGetExpenseDashboardQuery,
  useGetExpensesTotalQuery,
  useGetTransparencyQuery,
  useSetBudgetMutation,
  useListRecurringQuery,
  useCreateRecurringMutation,
  useUpdateRecurringMutation,
  usePostRecurringNowMutation,
  useListProvisionsQuery,
} = expensesApi;
