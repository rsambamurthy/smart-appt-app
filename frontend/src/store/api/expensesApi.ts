import { baseApi } from './baseApi';

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
    getExpensesTotal: builder.query<{ data: { total_expenses: number } }, void>({
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
    listRecurring: builder.query<{ data: unknown[] }, void>({
      query: () => '/expenses/recurring',
    }),
    createRecurring: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/expenses/recurring', method: 'POST', body }),
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
} = expensesApi;
