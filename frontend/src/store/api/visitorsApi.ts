import { baseApi } from './baseApi';

// ── Gate console types ────────────────────────────────────────────────────────

export interface GateUnit {
  id:              string;
  flat_number:     string;
  block:           string | null;
  floor:           number;
  primary_contact: string | null;
  occupant_count:  number;
}

export interface GateVisitor {
  id:             string;
  visitor_name:   string;
  visitor_phone:  string | null;
  purpose:        string | null;
  visit_type:     string;
  status:         string;
  vehicle_number: string | null;
  expected_at:    string | null;
  entered_at:     string | null;
  created_at:     string;
  unit:           { flat_number: string; block: string | null } | null;
  overstaying?:   boolean;
}

export interface GateBoard {
  awaiting: GateVisitor[];
  approved: GateVisitor[];
  inside:   GateVisitor[];
  counts: {
    awaiting:    number;
    approved:    number;
    inside:      number;
    today:       number;
    overstaying: number;
  };
}

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

    // ── Gate console ──────────────────────────────────────────────────────────
    // The flat directory rarely changes, so it is fetched once and cached.
    getGateUnits: builder.query<{ data: GateUnit[] }, void>({
      query: () => '/visitors/gate/units',
      providesTags: ['Unit'],
    }),
    // The board is the live view; the console polls it.
    getGateBoard: builder.query<{ data: GateBoard }, void>({
      query: () => '/visitors/gate/board',
      providesTags: ['Visitor'],
    }),

    // ── Resident ──────────────────────────────────────────────────────────────
    // Visitors waiting on this resident, and recently decided ones.
    getMyVisitorRequests: builder.query<{ data: { pending: GateVisitor[]; recent: GateVisitor[] } }, void>({
      query: () => '/visitors/my-requests',
      providesTags: ['Visitor'],
    }),
  }),
});

export const {
  usePreApproveVisitorMutation, useLogWalkInMutation, useApproveVisitorMutation,
  useRecordEntryMutation, useRecordExitMutation, useGetGateLogQuery,
  useLookupQrQuery, useListFrequentVisitorsQuery, useAddFrequentVisitorMutation, useTriggerEmergencyMutation,
  useGetGateUnitsQuery, useGetGateBoardQuery, useGetMyVisitorRequestsQuery,
} = visitorsApi;
