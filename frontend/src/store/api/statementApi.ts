import { baseApi } from './baseApi';

export interface StatementLine {
  date: string;
  kind: 'CHARGE' | 'PAYMENT';
  description: string;
  reference: string | null;
  /** Positive increases what the flat owes; negative reduces it. */
  amount: number;
  balance: number;
  /** Raised but not yet payable. Part of the balance, but not arrears. */
  not_yet_due?: boolean;
}

export interface Statement {
  unit: {
    id: string; flat_number: string; block: string | null;
    resident: string | null; phone: string | null;
  };
  period: { from: string; to: string };
  opening_balance: number;
  charged: number;
  paid: number;
  closing_balance: number;
  not_yet_due: number;
  penalty_charged: number;
  lines: StatementLine[];
}

export interface StatementSummaryRow {
  id: string;
  flat_number: string;
  block: string | null;
  billed: number;
  paid: number;
  balance: number;
  not_yet_due: number;
}

export const statementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Every flat's balance as at a date — the arrears list.
    getStatementSummary: builder.query<{
      data: StatementSummaryRow[];
      totals: {
        outstanding: number; in_credit: number; flats_owing: number;
        not_yet_due: number; overdue: number;
      };
      as_of: string;
    }, { as_of?: string } | void>({
      query: (a) => ({ url: '/dues/statement', params: { as_of: a?.as_of || undefined } }),
      providesTags: ['Statement'],
    }),

    // One flat's running ledger. A resident may fetch their own.
    getUnitStatement: builder.query<{ data: Statement }, {
      unitId: string; from?: string; to?: string;
    }>({
      query: ({ unitId, from, to }) => ({
        url: `/dues/statement/${unitId}`,
        params: { from: from || undefined, to: to || undefined },
      }),
      providesTags: ['Statement'],
    }),
  }),
});

export const { useGetStatementSummaryQuery, useGetUnitStatementQuery } = statementApi;
