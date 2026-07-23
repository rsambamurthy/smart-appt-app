import { baseApi } from './baseApi';

export const receiptsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listReceipts: builder.query<{ data: unknown[]; meta: object }, void>({
      query: () => '/receipts',
      providesTags: ['Receipt'],
    }),
    createReceipt: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/receipts', method: 'POST', body }),
      invalidatesTags: ['Receipt', 'Bill'], // invalidate Bill so ledger totals refresh
    }),
    deleteReceipt: builder.mutation<{ data: null }, string>({
      query: (id) => ({ url: `/receipts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Receipt', 'Bill'],
    }),
  }),
});

export const { useListReceiptsQuery, useCreateReceiptMutation, useDeleteReceiptMutation } = receiptsApi;
