import { baseApi } from './baseApi';

export type RecurringExpenseFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

export interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  vendor_id?: string | null;
  amount: number;
  frequency: RecurringExpenseFrequency;
  next_due_date: string;
  reminder_days: number;
  is_active: boolean;
  auto_provision: boolean;
  vendor?: { name: string } | null;
}

export interface RecurringExpenseInput {
  description: string;
  category: string;
  vendor_id?: string;
  amount: number;
  frequency: RecurringExpenseFrequency;
  next_due_date: string;
  reminder_days?: number;
  auto_provision?: boolean;
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

export interface Vendor {
  id: string;
  name: string;
  service_type?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
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
    deleteExpense: builder.mutation<{ data: unknown }, string>({
      query: (id) => ({ url: `/expenses/${id}`, method: 'DELETE' }),
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

    // ── Month-end provisions ────────────────────────────────────────────────
    listProvisions: builder.query<{ data: ExpenseProvision[] }, { status?: ProvisionStatus } | void>({
      query: (params) => ({ url: '/expenses/provisions', params: params ?? {} }),
      providesTags: ['Expense'],
    }),

    // ── Vendors (used to link a recurring expense for Accounts Payable) ─────
    listVendors: builder.query<{ data: Vendor[] }, void>({
      query: () => '/admin/vendors',
      providesTags: ['Expense'],
    }),
    createVendor: builder.mutation<{ data: Vendor }, { name: string; service_type?: string; phone?: string; email?: string }>({
      query: (body) => ({ url: '/admin/vendors', method: 'POST', body }),
      invalidatesTags: ['Expense'],
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
  useListProvisionsQuery,
  useListVendorsQuery,
  useCreateVendorMutation,
} = expensesApi;
