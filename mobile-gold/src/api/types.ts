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

// ── Accounting ────────────────────────────────────────────────
export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type: string;
  ob_side: string;
  is_group: boolean;
  is_control: boolean;
  opening_balance: number;
}
export interface JournalLine {
  id: string;
  account_id: string;
  account: Account;
  debit: number;
  credit: number;
  narration: string | null;
  business_partner_id: string | null;
}
export interface JournalEntry {
  id: string;
  voucher_number: string;
  voucher_type: string;
  entry_date: string;
  narration: string | null;
  total_debit: number;
  total_credit: number;
  lines: JournalLine[];
  created_at: string;
}
export interface LedgerLine {
  entry_date: string;
  voucher_number: string;
  narration: string | null;
  debit: number;
  credit: number;
  balance: number;
  running_side: string;
}
export interface PnLItem {
  account_code: string;
  account_name: string;
  amount: number;
}
export interface PnLReport {
  fy: string;
  income: PnLItem[];
  expenses: PnLItem[];
  total_income: number;
  total_expenses: number;
  net_surplus: number;
}
export interface BalanceSheetItem {
  account_code: string;
  account_name: string;
  amount: number;
}
export interface BalanceSheetReport {
  fy: string;
  assets: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  equity: BalanceSheetItem[];
  total_assets: number;
  total_liabilities_equity: number;
  balanced: boolean;
}
export interface FYClosure {
  id: string;
  fy: string;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
}
export interface BusinessPartner {
  id: string;
  name: string;
  category: string;
  bp_type?: { name: string };
  phone?: string;
  email?: string;
}

// ── Dues ──────────────────────────────────────────────────────
export interface Bill {
  id: string;
  bill_number: string;
  unit_number: string;
  owner_name: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  description: string | null;
}

// ── Announcements ─────────────────────────────────────────────
export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author?: { name: string };
}

// ── Maintenance ───────────────────────────────────────────────
export interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  unit_number: string;
  created_at: string;
}

// ── Visitors ──────────────────────────────────────────────────
export interface VisitorEntry {
  id: string;
  visitor_name: string;
  vehicle_number: string | null;
  unit_number: string;
  check_in: string;
  check_out: string | null;
  purpose: string | null;
}
