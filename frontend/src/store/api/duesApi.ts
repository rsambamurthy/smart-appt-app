import { baseApi } from './baseApi';

export type FeeType = 'MONTHLY_CHARGE' | 'PENALTY_AMOUNT' | 'CASH_OPENING_BALANCE';
export type CalcMethod = 'FIXED_AMOUNT' | 'RATE_PER_SQFT';

export interface FeeConfigRow {
  id?: string;
  fee_type: FeeType;
  calc_method?: CalcMethod | null;
  amount: number;
  due_day?: number | null;
  as_on_date?: string | null;
  is_active: boolean;
}

export const duesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDuesConfig: builder.query<{ data: unknown }, void>({ query: () => '/dues/config', providesTags: ['Bill'] }),
    updateDuesConfig: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/dues/config', method: 'PUT', body }), invalidatesTags: ['Bill'] }),
    generateBills: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/dues/bills/generate', method: 'POST', body }), invalidatesTags: ['Bill'] }),
    rollbackBills: builder.mutation<{ data: { deleted: number; month: number; year: number } }, { month: number; year: number }>({ query: (body) => ({ url: '/dues/bills/rollback', method: 'POST', body }), invalidatesTags: ['Bill'] }),
    listBills: builder.query<{ data: unknown[]; meta: object }, object>({ query: (params) => ({ url: '/dues/bills', params }), providesTags: ['Bill'] }),
    listMyBills: builder.query<{ data: unknown[]; meta: object }, object>({ query: (params) => ({ url: '/dues/bills/my', params }), providesTags: ['Bill'] }),
    initiatePayment: builder.mutation<{ data: { order_id: string; amount: number; key_id: string; bill: { id: string; period_month: number; period_year: number } } }, { bill_id: string }>({ query: (body) => ({ url: '/dues/payments/initiate', method: 'POST', body }), invalidatesTags: ['Payment'] }),
    verifyPayment: builder.mutation<{ data: { status: string; payment_id?: string } }, { bill_id: string; razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }>({ query: (body) => ({ url: '/dues/payments/verify', method: 'POST', body }), invalidatesTags: ['Bill', 'Payment'] }),
    recordOfflinePayment: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/dues/payments/offline', method: 'POST', body }), invalidatesTags: ['Bill', 'Payment'] }),
    getArrears: builder.query<{ data: unknown[] }, void>({ query: () => '/dues/arrears', providesTags: ['Bill'] }),
    createLevy: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/dues/levy', method: 'POST', body }), invalidatesTags: ['Bill'] }),
    getDuesDashboard: builder.query<{ data: unknown }, void>({ query: () => '/dues/dashboard', providesTags: ['Bill'] }),
    // One-time dues
    listOneTimeDues: builder.query<{ data: unknown[] }, void>({ query: () => '/dues/one-time-dues', providesTags: ['Bill'] }),
    createOneTimeDue: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/dues/one-time-dues', method: 'POST', body }), invalidatesTags: ['Bill'] }),
    updateOneTimeDue: builder.mutation<{ data: unknown }, { id: string; body: object }>({ query: ({ id, body }) => ({ url: `/dues/one-time-dues/${id}`, method: 'PATCH', body }), invalidatesTags: ['Bill'] }),
    deleteOneTimeDue: builder.mutation<{ data: null }, string>({ query: (id) => ({ url: `/dues/one-time-dues/${id}`, method: 'DELETE' }), invalidatesTags: ['Bill'] }),
    generateOneTimeDueBills: builder.mutation<{ data: { created: number; skipped: number } }, { id: string; body: object }>({ query: ({ id, body }) => ({ url: `/dues/one-time-dues/${id}/generate-bills`, method: 'POST', body }), invalidatesTags: ['Bill'] }),
    deleteOneTimeDueBills: builder.mutation<{ data: { deleted: boolean } }, string>({ query: (id) => ({ url: `/dues/one-time-dues/${id}/bills`, method: 'DELETE' }), invalidatesTags: ['Bill'] }),
    closeOneTimeDue: builder.mutation<{ data: unknown }, string>({ query: (id) => ({ url: `/dues/one-time-dues/${id}/close`, method: 'POST', body: {} }), invalidatesTags: ['Bill'] }),
    getRazorpayConfig: builder.query<{ data: { razorpay_key_id: string | null; has_key_secret: boolean } }, void>({ query: () => '/dues/razorpay-config', providesTags: ['Bill'] }),
    saveRazorpayConfig: builder.mutation<{ data: unknown }, { razorpay_key_id: string; razorpay_key_secret: string }>({ query: (body) => ({ url: '/dues/razorpay-config', method: 'PUT', body }), invalidatesTags: ['Bill'] }),
    // Fee configs
    listFeeConfigs: builder.query<{ data: FeeConfigRow[] }, void>({ query: () => '/dues/fee-configs', providesTags: ['Bill'] }),
    saveFeeConfigs: builder.mutation<{ data: FeeConfigRow[] }, FeeConfigRow[]>({ query: (body) => ({ url: '/dues/fee-configs', method: 'PUT', body }), invalidatesTags: ['Bill'] }),
    deleteFeeConfig: builder.mutation<{ data: unknown }, string>({ query: (id) => ({ url: `/dues/fee-configs/${id}`, method: 'DELETE' }), invalidatesTags: ['Bill'] }),
  }),
});

export const {
  useGetDuesConfigQuery, useUpdateDuesConfigMutation, useGenerateBillsMutation,
  useRollbackBillsMutation, useListBillsQuery, useListMyBillsQuery, useInitiatePaymentMutation,
  useVerifyPaymentMutation,
  useRecordOfflinePaymentMutation, useGetArrearsQuery, useCreateLevyMutation, useGetDuesDashboardQuery,
  useListOneTimeDuesQuery, useCreateOneTimeDueMutation, useUpdateOneTimeDueMutation,
  useDeleteOneTimeDueMutation, useGenerateOneTimeDueBillsMutation, useDeleteOneTimeDueBillsMutation, useCloseOneTimeDueMutation,
  useGetRazorpayConfigQuery, useSaveRazorpayConfigMutation,
  useListFeeConfigsQuery, useSaveFeeConfigsMutation, useDeleteFeeConfigMutation,
} = duesApi;
