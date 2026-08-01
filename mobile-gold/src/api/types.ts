// ── Auth ──────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  association_id: string;
  unit_number?: string;
}
export interface LoginResponse {
  data: { access_token: string; refresh_token?: string; user: AuthUser };
}
export interface OtpRequestResponse {
  data: { wa_status?: { sent: boolean; error?: string }; dev_otp?: string };
}
export interface MpinStatusResponse {
  data: { has_mpin: boolean };
}
export interface MobileConfigResponse {
  data: MobileConfig;
}
export interface MobileConfig {
  association_id: string;
  app_name: string | null;
  logo_url: string | null;
  theme_color: string | null;
  feature_bills: boolean;
  feature_announcements: boolean;
  feature_complaints: boolean;
  feature_visitors: boolean;
  // Accounting feature flags (Gold)
  feature_journal: boolean;
  feature_ledger: boolean;
  feature_pnl: boolean;
  feature_balance_sheet: boolean;
  feature_coa: boolean;
  feature_fy_closure: boolean;
  login_mpin_enabled: boolean;
  menu_items: Record<string, { enabled: boolean; can_post?: boolean }> | null;
}

// ── Accounting (shapes match backend journal.service.ts exactly) ──
export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;       // ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
  sub_type: string | null;
  is_group: boolean;
  is_active: boolean;
}
export interface JournalLine {
  id: string;
  debit: string | number;   // Prisma Decimal serialises as string
  credit: string | number;
  narration: string | null;
  account?: { code: string; name: string; type: string };
  business_partner?: { id: string; code: string; name: string } | null;
}
export interface JournalEntry {
  id: string;
  reference_code: string;   // e.g. RV-2024-25-0001
  voucher_type: string;
  financial_year: string;
  entry_date: string;
  narration: string | null;
  status: string;
  source: string;
  lines: JournalLine[];
  created_at: string;
}
export interface LedgerRow {
  id: string;
  entry_date: string;
  narration: string | null;
  reference_code: string;
  voucher_type: string;
  debit: number;
  credit: number;
  balance: number;
  business_partner?: { id: string; code: string; name: string } | null;
}
export interface LedgerReport {
  account: { id: string; code: string; name: string; type: string; sub_type: string | null };
  isDebitNormal: boolean;
  baseOB: number;
  openingBalance: number;
  closingBalance: number;
  rows: LedgerRow[];
}
export interface PnLItem {
  id: string;
  code: string;
  name: string;
  sub_type: string | null;
  amount: number;
}
export interface PnLReport {
  period: { from: string; to: string };
  income: PnLItem[];
  expense: PnLItem[];
  totalIncome: number;
  totalExpense: number;
  netSurplus: number;
}
export interface BalanceSheetItem {
  id: string;
  code: string;
  name: string;
  sub_type: string | null;
  amount: number;
}
export interface BalanceSheetReport {
  asOf: string;
  assets: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  equity: BalanceSheetItem[];
  netSurplus: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
}
export interface FYInfo {
  financial_year: string;
  is_current: boolean;
  is_closed: boolean;
  status: string;             // OPEN | CLOSED | ...
  net_surplus: number | null;
  closed_at: string | null;
  closed_by: string | null;
}
export interface BusinessPartner {
  id: string;
  code: string;
  name: string;
  bp_category: string;        // BANK | VENDOR | UNIT
  bp_type?: { id: string; name: string; side: string } | null;
  phone?: string | null;
  email?: string | null;
}

// ── Dues (shape matches backend Bill model) ───────────────────
export interface Bill {
  id: string;
  period_month: number;
  period_year: number;
  base_amount: string | number;    // Prisma Decimal serialises as string
  penalty: string | number;
  levy_amount: string | number;
  total_amount: string | number;
  due_date: string;
  status: string;                  // UNPAID | PARTIAL | PAID | WAIVED
  bill_label: string | null;
  unit?: { flat_number: string; block: string | null } | null;
  payments?: { id: string; amount: string | number; payment_mode: string; payment_date: string }[];
}

// ── Announcements ─────────────────────────────────────────────
export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  is_urgent: boolean;
  published_at: string | null;
  created_at: string;
  poster?: { name: string; role: string } | null;
}

// ── Maintenance ───────────────────────────────────────────────
export interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  status: string;    // SUBMITTED | ACKNOWLEDGED | IN_PROGRESS | RESOLVED | CLOSED
  priority: string;  // LOW | MEDIUM | HIGH | URGENT
  category: string;
  created_at: string;
  unit?: { flat_number: string; block: string | null } | null;
  raiser?: { name: string } | null;
}

// ── Visitors ──────────────────────────────────────────────────
export interface VisitorEntry {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  vehicle_number: string | null;
  purpose: string | null;
  status: string;          // PENDING | APPROVED | ...
  entered_at: string | null;
  exited_at: string | null;
  created_at: string;
  unit?: { flat_number: string; block: string | null } | null;
}
