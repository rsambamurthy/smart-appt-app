import { baseApi } from './baseApi';

export const visitorsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    preApproveVisitor: builder.mutation<{ data: { qr_token: string } }, object>({ query: (body) => ({ url: '/visitors/preapprove', method: 'POST', body }), invalidatesTags: ['Visitor'] }),
    logWalkIn: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/visitors/walkin', method: 'POST', body }), invalidatesTags: ['Visitor'] }),
    approveVisitor: builder.mutation<{ data: unknown }, { id: string; decision: string }>({ query: ({ id, decision }) => ({ url: `/visitors/${id}/approve`, method: 'POST', body: { decision } }), invalidatesTags: ['Visitor'] }),
    recordEntry: builder.mutation<void, string>({ query: (id) => ({ url: `/visitors/${id}/entry`, method: 'POST' }), invalidatesTags: ['Visitor'] }),
    recordExit: builder.mutation<void, string>({ query: (id) => ({ url: `/visitors/${id}/exit`, method: 'POST' }), invalidatesTags: ['Visitor'] }),
    getGateLog: builder.query<{ data: unknown[] }, object>({ query: (params) => ({ url: '/visitors/log', params }), providesTags: ['Visitor'] }),
    lookupQr: builder.query<{ data: unknown }, string>({ query: (token) => `/visitors/qr/${token}` }),
    listFrequentVisitors: builder.query<{ data: unknown[] }, void>({ query: () => '/visitors/frequent/my', providesTags: ['Visitor'] }),
    addFrequentVisitor: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/visitors/frequent', method: 'POST', body }), invalidatesTags: ['Visitor'] }),
    triggerEmergency: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/visitors/emergency', method: 'POST', body }) }),
  }),
});

export const {
  usePreApproveVisitorMutation, useLogWalkInMutation, useApproveVisitorMutation,
  useRecordEntryMutation, useRecordExitMutation, useGetGateLogQuery,
  useLookupQrQuery, useListFrequentVisitorsQuery, useAddFrequentVisitorMutation, useTriggerEmergencyMutation,
} = visitorsApi;
