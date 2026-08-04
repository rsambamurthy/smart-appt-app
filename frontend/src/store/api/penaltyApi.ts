import { baseApi } from './baseApi';

export interface PenaltyCandidate {
  bill_id:      string;
  unit_id:      string;
  flat_number:  string;
  block:        string | null;
  resident:     string | null;
  period:       string;
  due_date:     string;
  days_overdue: number;
  bill_amount:  number;
  outstanding:  number;
  penalty:      number;
}

export interface PenaltyPreview {
  data:   PenaltyCandidate[];
  config: { penalty_type: 'FLAT' | 'PERCENTAGE'; penalty_value: number; grace_days: number };
  as_of:  string;
  totals: { flats: number; bills: number; penalty: number };
}

export interface PenaltyApplyResult {
  charged: Array<{ bill_id: string; flat_number: string; amount: number }>;
  skipped: Array<{ bill_id: string; flat_number: string; reason: string }>;
  totals:  { charged: number; skipped: number; amount: number };
}

export interface PenaltyRecord {
  id:           string;
  bill_id:      string;
  period:       string;
  due_date:     string;
  amount:       number;
  days_overdue: number;
  charged_on:   string;
  charged_by:   string;
  basis:        string;
  waived:       boolean;
  waived_on:    string | null;
  waived_by:    string | null;
  waive_reason: string | null;
}

export const penaltyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    previewPenalties: builder.query<PenaltyPreview, { as_of?: string } | void>({
      query: (a) => ({ url: '/dues/penalties/preview', params: { as_of: a?.as_of || undefined } }),
      providesTags: ['Penalty'],
    }),

    applyPenalties: builder.mutation<PenaltyApplyResult, { bill_ids: string[]; as_of?: string }>({
      query: (body) => ({ url: '/dues/penalties/apply', method: 'POST', body }),
      // Penalties move the bill total, so the statement and the bill list are
      // both stale the moment this succeeds.
      invalidatesTags: ['Penalty', 'Statement', 'Bill'],
    }),

    unitPenalties: builder.query<{ data: PenaltyRecord[] }, string>({
      query: (unitId) => ({ url: `/dues/penalties/unit/${unitId}` }),
      providesTags: ['Penalty'],
    }),

    waivePenalty: builder.mutation<
      { id: string; amount: number; waived_on: string },
      { id: string; reason: string }
    >({
      query: ({ id, reason }) => ({
        url: `/dues/penalties/${id}/waive`, method: 'POST', body: { reason },
      }),
      invalidatesTags: ['Penalty', 'Statement', 'Bill'],
    }),
  }),
});

export const {
  usePreviewPenaltiesQuery,
  useApplyPenaltiesMutation,
  useUnitPenaltiesQuery,
  useWaivePenaltyMutation,
} = penaltyApi;
