// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  role: string;
  association_id: string;
  unit_id?: string;
}

export interface LoginResponse {
  data: {
    access_token: string;
    user: AuthUser;
  };
}

// ── Mobile Config ─────────────────────────────────────────────────────────────
export interface MenuItemConfig {
  enabled: boolean;
  can_post: boolean;
}

export interface MobileConfig {
  feature_bills: boolean;
  feature_announcements: boolean;
  feature_complaints: boolean;
  feature_visitors: boolean;
  push_dues_reminder: boolean;
  push_announcements: boolean;
  push_visitor_alerts: boolean;
  login_mpin_enabled: boolean;
  login_biometric: boolean;
  login_otp_only: boolean;
  app_name: string | null;
  theme_color: string | null;
  logo_url: string | null;
  menu_items: Record<string, MenuItemConfig> | null;
}

export interface MobileConfigResponse {
  data: MobileConfig;
}

// ── Bills ─────────────────────────────────────────────────────────────────────
export interface Bill {
  id: string;
  bill_no: string;
  period: string;
  amount: number;
  penalty: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
  due_date: string;
  paid_at?: string;
}

export interface BillsResponse {
  data: Bill[];
}

// ── Announcements ─────────────────────────────────────────────────────────────
export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author?: { name: string };
}

// ── Maintenance ───────────────────────────────────────────────────────────────
export interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
  resolved_at?: string;
}

// ── Visitors ──────────────────────────────────────────────────────────────────
export interface VisitorEntry {
  id: string;
  visitor_name: string;
  purpose: string;
  host_unit?: string;
  checked_in_at: string;
  checked_out_at?: string;
}

// ── Accounting ────────────────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  entry_no: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: string;
}

export interface LedgerLine {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  entry_no: string;
}

export interface PnLReport {
  income: { account: string; amount: number }[];
  expenses: { account: string; amount: number }[];
  net_surplus: number;
  financial_year: string;
}

export interface BalanceSheetReport {
  assets: { account: string; amount: number }[];
  liabilities: { account: string; amount: number }[];
  equity: { account: string; amount: number }[];
  financial_year: string;
}
