import { baseApi } from './baseApi';

// ── Response shapes (mirror backend analytics.service.ts) ────────────────────

export interface MonthPoint   { period: string; billed: number; collected: number; efficiency: number }
export interface AgeingBucket { bucket: string; amount: number; bills: number }
export interface Defaulter    { unit: string; unpaid_bills: number; outstanding: number; oldest_due: string }
export interface PaymentMode  { mode: string; total: number; txns: number }

export interface CollectionsInsight {
  series: MonthPoint[];
  totalBilled: number;
  totalCollected: number;
  efficiency: number;
  outstanding: number;
  ageing: AgeingBucket[];
  defaulters: Defaulter[];
  payment_modes: PaymentMode[];
  cash_share_pct: number;
}

export interface SpendPoint  { period: string; total: number }
export interface CategorySpend { category: string; total: number; txns: number }
export interface VendorSpend   { vendor: string; total: number; txns: number }
export interface SpendAnomaly  { category: string; latest: number; avg_prior: number; increase_pct: number }

export interface ExpenseInsight {
  series: SpendPoint[];
  totalSpend: number;
  avgMonthly: number;
  categories: CategorySpend[];
  vendors: VendorSpend[];
  topVendorShare: number;
  anomalies: SpendAnomaly[];
}

export interface CategoryOps { category: string; tickets: number; avg_hours: number | null; breached: number }
export interface RepeatIssue { unit: string; category: string; tickets: number }

export interface MaintenanceInsight {
  total: number;
  open: number;
  breached: number;
  breach_rate: number;
  avg_rating: number | null;
  by_category: CategoryOps[];
  repeat_issues: RepeatIssue[];
}

export interface AuditActionCount { action: string; events: number }
export interface FinancialChange {
  id: string; action: string; entity_type: string;
  summary: string | null; created_at: string;
  performer?: { name: string; role: string } | null;
}

export interface GovernanceInsight {
  by_action: AuditActionCount[];
  failed_logins: number;
  distinct_actors: number;
  after_hours_changes: number;
  destructive_actions: number;
  recent_financial_changes: FinancialChange[];
}

export interface Insights {
  months: number;
  collections: CollectionsInsight;
  expenses: ExpenseInsight;
  maintenance: MaintenanceInsight;
  governance: GovernanceInsight;
}

export const analyticsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInsights: builder.query<{ data: Insights }, number | void>({
      query: (months) => `/analytics/insights?months=${months ?? 6}`,
    }),
  }),
});

export const { useGetInsightsQuery } = analyticsApi;
