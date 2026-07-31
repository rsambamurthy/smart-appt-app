import { baseApi } from './baseApi';

export interface PaymentUploadRow {
  row_num:        number;
  flat_number:    string;
  block:          string | null;
  period_month:   number | null;
  period_year:    number | null;
  amount:         number | null;
  mode:           string | null;
  payment_date:   string | null;
  reference_no:   string | null;
  bill_id:        string | null;
  unit_id:        string | null;
  current_status: string | null;
  status:         'create' | 'skip' | 'error';
  error?:         string;
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
    // Bulk Payment Upload
    previewPaymentUpload: builder.mutation<{ data: PaymentUploadRow[] }, FormData>({
      query: (formData) => ({ url: '/dues/payments/upload/preview', method: 'POST', body: formData }),
    }),
    applyPaymentUpload: builder.mutation<{ data: { created: number } }, PaymentUploadRow[]>({
      query: (rows) => ({ url: '/dues/payments/upload/apply', method: 'POST', body: { rows } }),
      invalidatesTags: ['Bill', 'Payment'],
    }),
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
  usePreviewPaymentUploadMutation, useApplyPaymentUploadMutation,
} = duesApi;
