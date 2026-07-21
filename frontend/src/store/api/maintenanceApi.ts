import { baseApi } from './baseApi';

export const maintenanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTickets: builder.query<{ data: unknown[]; meta: object }, object>({
      query: (params) => ({ url: '/maintenance', params }),
      providesTags: ['Ticket'],
    }),
    listMyTickets: builder.query<{ data: unknown[]; meta: object }, object>({
      query: (params) => ({ url: '/maintenance/my', params }),
      providesTags: ['Ticket'],
    }),
    getTicket: builder.query<{ data: unknown }, string>({
      query: (id) => `/maintenance/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Ticket', id }],
    }),
    createTicket: builder.mutation<{ data: unknown }, FormData>({
      query: (body) => ({ url: '/maintenance', method: 'POST', body }),
      invalidatesTags: ['Ticket'],
    }),
    assignTicket: builder.mutation<{ data: unknown }, { id: string; body: object }>({
      query: ({ id, body }) => ({ url: `/maintenance/${id}/assign`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Ticket', id }],
    }),
    updateStatus: builder.mutation<{ data: unknown }, { id: string; body: { status: string; note?: string } }>({
      query: ({ id, body }) => ({ url: `/maintenance/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Ticket', id }],
    }),
    submitFeedback: builder.mutation<{ data: unknown }, { id: string; body: { rating: number; comment?: string } }>({
      query: ({ id, body }) => ({ url: `/maintenance/${id}/feedback`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Ticket', id }],
    }),
    getDashboard: builder.query<{ data: unknown }, void>({
      query: () => '/maintenance/dashboard',
    }),
  }),
});

export const {
  useListTicketsQuery, useListMyTicketsQuery, useGetTicketQuery,
  useCreateTicketMutation, useAssignTicketMutation, useUpdateStatusMutation,
  useSubmitFeedbackMutation, useGetDashboardQuery,
} = maintenanceApi;
