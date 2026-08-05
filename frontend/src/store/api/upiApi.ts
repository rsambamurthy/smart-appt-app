import { baseApi } from './baseApi';

export interface UpiConfig {
  enabled:      boolean;
  bank_bp_id:   string | null;
  bank_name:    string | null;
  upi_vpa:      string | null;
  payee_name:   string;
  account_hint: string | null;
}

/** A bank account that could collect UPI. */
export interface UpiBankAccount {
  id:             string;
  code:           string;
  name:           string;
  is_active:      boolean;
  upi_vpa:        string | null;
  upi_payee_name: string | null;
  account_number: string | null;
  selected:       boolean;
}

export interface UpiIntent {
  upi_uri:     string;
  amount:      number;
  payee_name:  string;
  upi_vpa:     string;
  intent_ref:  string;
  flat_number: string;
  description: string;
  pending_claim: {
    id: string; amount: number; upi_reference: string; claimed_at: string;
  } | null;
}

export type ClaimStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface MyClaim {
  id:            string;
  bill_id:       string;
  amount:        number;
  upi_reference: string;
  paid_on:       string;
  status:        ClaimStatus;
  review_note:   string | null;
  reviewed_at:   string | null;
}

export interface PendingClaim {
  id:            string;
  flat_number:   string;
  block:         string | null;
  resident:      string;
  phone:         string;
  amount:        number;
  bill_total:    number;
  upi_reference: string;
  paid_on:       string;
  claimed_at:    string;
  status:        ClaimStatus;
  review_note:   string | null;
  reviewed_by:   string | null;
  period:        string;
}

export const upiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUpiConfig: builder.query<{ data: UpiConfig }, void>({
      query: () => '/dues/upi/config',
      providesTags: ['UpiConfig'],
    }),
    // Bank accounts that could collect UPI, and which one is selected.
    listUpiAccounts: builder.query<{ data: UpiBankAccount[] }, void>({
      query: () => '/dues/upi/accounts',
      providesTags: ['UpiConfig'],
    }),

    // The UPI ID lives on the bank record, because a VPA credits exactly one
    // account and the payee name has to match whoever holds it.
    saveBankUpi: builder.mutation<
      { data: UpiBankAccount[] },
      { bpId: string; upi_vpa: string | null; upi_payee_name?: string | null }
    >({
      query: ({ bpId, ...body }) => ({ url: `/dues/upi/accounts/${bpId}`, method: 'PUT', body }),
      invalidatesTags: ['UpiConfig'],
    }),

    selectUpiAccount: builder.mutation<{ data: UpiConfig }, { bank_bp_id: string | null }>({
      query: (body) => ({ url: '/dues/upi/config', method: 'PUT', body }),
      invalidatesTags: ['UpiConfig'],
    }),

    // Fetched on demand rather than with the bill list: it is only needed the
    // moment someone taps Pay, and it embeds an amount that must be current.
    getUpiIntent: builder.query<{ data: UpiIntent }, string>({
      query: (billId) => `/dues/upi/intent/${billId}`,
      providesTags: ['PaymentClaim'],
    }),

    submitUpiClaim: builder.mutation<
      { data: { id: string; status: ClaimStatus } },
      { bill_id: string; amount: number; upi_reference: string; paid_on?: string; intent_ref?: string }
    >({
      query: (body) => ({ url: '/dues/upi/claims', method: 'POST', body }),
      // The bill does not change — nothing is settled yet — but its displayed
      // state does, from "Unpaid" to "Paid, to be confirmed".
      invalidatesTags: ['PaymentClaim', 'Bill'],
    }),

    myUpiClaims: builder.query<{ data: MyClaim[] }, void>({
      query: () => '/dues/upi/claims/mine',
      providesTags: ['PaymentClaim'],
    }),

    listUpiClaims: builder.query<
      { data: PendingClaim[]; totals: { count: number; amount: number } },
      { status?: ClaimStatus } | void
    >({
      query: (a) => ({ url: '/dues/upi/claims', params: { status: a?.status || undefined } }),
      providesTags: ['PaymentClaim'],
    }),

    confirmUpiClaim: builder.mutation<{ data: { id: string; payment_id: string } }, string>({
      query: (id) => ({ url: `/dues/upi/claims/${id}/confirm`, method: 'POST' }),
      // Confirmation creates a real payment, so everything downstream moves.
      invalidatesTags: ['PaymentClaim', 'Bill', 'Payment', 'Statement', 'Journal'],
    }),

    rejectUpiClaim: builder.mutation<
      { data: { id: string; status: ClaimStatus } },
      { id: string; note: string }
    >({
      query: ({ id, note }) => ({ url: `/dues/upi/claims/${id}/reject`, method: 'POST', body: { note } }),
      invalidatesTags: ['PaymentClaim'],
    }),
  }),
});

export const {
  useGetUpiConfigQuery,
  useListUpiAccountsQuery,
  useSaveBankUpiMutation,
  useSelectUpiAccountMutation,
  useLazyGetUpiIntentQuery,
  useSubmitUpiClaimMutation,
  useMyUpiClaimsQuery,
  useListUpiClaimsQuery,
  useConfirmUpiClaimMutation,
  useRejectUpiClaimMutation,
} = upiApi;
