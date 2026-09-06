import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

// Platform
import { IS_NATIVE } from './hooks/usePlatform';
import { MobileConfigProvider } from './contexts/MobileConfigContext';
import MobileLayout from './components/organisms/MobileLayout';
import MobileHomePage from './pages/mobile/MobileHomePage';
import MobileMorePage from './pages/mobile/MobileMorePage';
import MobileBillsPage from './pages/mobile/MobileBillsPage';
import MobileStatementPage from './pages/mobile/MobileStatementPage';
import MobileChatPage from './pages/mobile/MobileChatPage';
import MobileChatThreadPage from './pages/mobile/MobileChatThreadPage';
import MobileVisitorsPage from './pages/mobile/MobileVisitorsPage';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketListPage from './pages/maintenance/TicketListPage';
import RaiseTicketPage from './pages/maintenance/RaiseTicketPage';
import TicketDetailPage from './pages/maintenance/TicketDetailPage';
import DuesDashboardPage from './pages/dues/DuesDashboardPage';
import DuesBillsPage from './pages/dues/DuesBillsPage';
import DuesConfigPage from './pages/dues/DuesConfigPage';
import RazorpayConfigPage from './pages/config/RazorpayConfigPage';
import MyBillsPage from './pages/dues/MyBillsPage';
import PaymentPage from './pages/dues/PaymentPage';
import ExpenseListPage from './pages/expenses/ExpenseListPage';
import ExpenseDashboardPage from './pages/expenses/ExpenseDashboardPage';
import TransparencyPage from './pages/expenses/TransparencyPage';
import ExpenseCategoriesPage from './pages/expenses/ExpenseCategoriesPage';
import RecurringExpensesPage from './pages/expenses/RecurringExpensesPage';
import AnnouncementFeedPage from './pages/announcements/AnnouncementFeedPage';
import DocumentRepositoryPage from './pages/announcements/DocumentRepositoryPage';
import VisitorLogPage from './pages/visitors/VisitorLogPage';
import GateDashboardPage from './pages/visitors/GateDashboardPage';
import PreApproveVisitorPage from './pages/visitors/PreApproveVisitorPage';
import VisitorRequestsPage from './pages/visitors/VisitorRequestsPage';
import UnitManagementPage from './pages/admin/UnitManagementPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import UnitDetailPage from './pages/admin/UnitDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterAssociationPage from './pages/RegisterAssociationPage';
import AssociationManagementPage from './pages/admin/AssociationManagementPage';
import AssociationDetailPage from './pages/admin/AssociationDetailPage';
import SubscriptionsPage from './pages/admin/SubscriptionsPage';
import MeetingsPage from './pages/governance/MeetingsPage';
import CommitteesPage from './pages/governance/CommitteesPage';
import RegisterPage from './pages/governance/RegisterPage';
import ElectionsPage from './pages/governance/ElectionsPage';
import CompliancePage from './pages/governance/CompliancePage';
import MeetingDetailPage from './pages/governance/MeetingDetailPage';
import MyMeetingsPage from './pages/governance/MyMeetingsPage';
import OneTimeDuesPage from './pages/dues/OneTimeDuesPage';
import ArrearsPage from './pages/dues/ArrearsPage';
import StatementPage, { MyStatementPage } from './pages/dues/StatementPage';
import ChatPage from './pages/chat/ChatPage';
import PenaltyRunPage from './pages/dues/PenaltyRunPage';
import UpiClaimsPage from './pages/dues/UpiClaimsPage';
import OtherReceiptsPage from './pages/receipts/OtherReceiptsPage';
import WebMenuPage from './pages/admin/WebMenuPage';
import MobileMenuPage from './pages/admin/MobileMenuPage';
import BrandingPage from './pages/admin/BrandingPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import InsightsPage from './pages/reports/InsightsPage';
import ChangeMpinPage from './pages/ChangeMpinPage';
import TransactionsDashboardPage from './pages/transactions/TransactionsDashboardPage';
import ReportsPage from './pages/transactions/ReportsPage';
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage';
import BusinessPartnersPage from './pages/accounting/BusinessPartnersPage';
import JournalEntriesPage from './pages/accounting/JournalEntriesPage';
import LedgerPage from './pages/accounting/LedgerPage';
import PnLPage from './pages/accounting/PnLPage';
import BalanceSheetPage from './pages/accounting/BalanceSheetPage';
import TrialBalancePage from './pages/accounting/TrialBalancePage';
import CashBookPage from './pages/accounting/CashBookPage';
import DayBookPage from './pages/accounting/DayBookPage';
import ReceiptsPaymentsPage from './pages/accounting/ReceiptsPaymentsPage';
import IncomeExpenditurePage from './pages/accounting/IncomeExpenditurePage';
import FYClosurePage    from './pages/accounting/FYClosurePage';
import MenuFeatureGate from './components/organisms/MenuFeatureGate';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token = useSelector((s: RootState) => s.auth.access_token);
  return token ? children : <Navigate to="/login" replace />;
};

const RoleRoute = ({ roles, children }: { roles: string[]; children: JSX.Element }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  // SUPER_USER bypasses all role restrictions
  if (user.role === 'SUPER_USER') return children;
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <MobileConfigProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterAssociationPage />} />

        {/* ── Mobile routing tree (only active when running inside Capacitor) ── */}
        {IS_NATIVE && (
          <Route element={<MobileLayout />}>
            <Route index element={<Navigate to="/mobile/home" replace />} />
            <Route path="/mobile/home" element={<MobileHomePage />} />
            <Route path="/mobile/bills" element={<ProtectedRoute><MobileBillsPage /></ProtectedRoute>} />
            <Route path="/mobile/statement" element={<ProtectedRoute><MobileStatementPage /></ProtectedRoute>} />
            <Route path="/mobile/chat" element={<ProtectedRoute><MobileChatPage /></ProtectedRoute>} />
            <Route path="/mobile/chat/:id" element={<ProtectedRoute><MobileChatThreadPage /></ProtectedRoute>} />
            <Route path="/mobile/visitors" element={<ProtectedRoute><MobileVisitorsPage /></ProtectedRoute>} />
            <Route path="/mobile/visitors/log" element={<ProtectedRoute><VisitorLogPage /></ProtectedRoute>} />
            <Route path="/mobile/visitors/preapprove" element={<ProtectedRoute><PreApproveVisitorPage /></ProtectedRoute>} />
            <Route path="/mobile/visitors/requests" element={<ProtectedRoute><VisitorRequestsPage /></ProtectedRoute>} />
            {/* Gate console on a phone. Camera capture only works from the
                installed app or a mobile browser, not desktop.
                GATE_STAFF only, matching the desktop /gate route — every
                action behind this screen is GATE_STAFF-only on the server. */}
            <Route path="/mobile/gate" element={<RoleRoute roles={['GATE_STAFF']}><GateDashboardPage /></RoleRoute>} />
            <Route path="/mobile/more" element={<MobileMorePage />} />
            <Route path="/announcements" element={<ProtectedRoute><AnnouncementFeedPage /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><TicketListPage /></ProtectedRoute>} />
            <Route path="/maintenance/new" element={<ProtectedRoute><RaiseTicketPage /></ProtectedRoute>} />
            <Route path="/maintenance/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />
            <Route path="/change-mpin" element={<ProtectedRoute><ChangeMpinPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/mobile/home" replace />} />
          </Route>
        )}

        {/* ── Web-only routes — not present on native mobile ── */}
        {!IS_NATIVE && <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />}

        {/* Maintenance */}
        {!IS_NATIVE && <Route path="/maintenance" element={<ProtectedRoute><TicketListPage /></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/maintenance/new" element={<ProtectedRoute><RaiseTicketPage /></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/maintenance/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />}

        {/* Dues */}
        {/* dues_bills, dues_config, razorpay_config are menu features now —
            Web Menu Configuration decides who's in, enforced by
            requireMenuFeature on the backend and useMenuItemEnabled inside
            each page, so the route itself no longer needs a role list. */}
        {!IS_NATIVE && <Route path="/dues" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><DuesDashboardPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/bills" element={<ProtectedRoute><MenuFeatureGate itemId="dues_bills" label="Bills & Payments"><DuesBillsPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dues/config" element={<ProtectedRoute><MenuFeatureGate itemId="dues_config" label="Fee Configuration"><DuesConfigPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/config/razorpay" element={<ProtectedRoute><MenuFeatureGate itemId="razorpay_config" label="Razorpay"><RazorpayConfigPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dues/my-bills" element={<RoleRoute roles={['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER']}><MyBillsPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/my-statement" element={<RoleRoute roles={['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER']}><MyStatementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/pay/:billId" element={<RoleRoute roles={['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER']}><PaymentPage /></RoleRoute>} />}
        {/* Entry point for the native app's Custom Tab handoff (see
            hooks/useRazorpay.ts) — a fresh browser session with no
            state.auth.user yet, so it deliberately skips RoleRoute (which
            would bounce straight to /login on a null user). The access
            token in the URL is still required for every API call the page
            makes, and the backend re-checks that the bill actually belongs
            to that token's user — this route is a UX convenience, not the
            security boundary. */}
        {!IS_NATIVE && <Route path="/dues/pay-native/:billId" element={<PaymentPage />} />}
        {/* chat keeps its own fixed RoleRoute — it's a deliberate, documented
            exception where even SUPER_USER is excluded (see chat.routes.ts's
            CHAT_ROLES), which requireMenuFeature's blanket SUPER_USER bypass
            would silently undo, so it doesn't get the same treatment. */}
        {!IS_NATIVE && <Route path="/chat" element={<RoleRoute roles={['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER']}><ChatPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/one-time-dues" element={<ProtectedRoute><MenuFeatureGate itemId="dues_one_time" label="One-Time Dues"><OneTimeDuesPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dues/arrears" element={<ProtectedRoute><MenuFeatureGate itemId="dues_arrears" label="Arrears"><ArrearsPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dues/statement" element={<ProtectedRoute><MenuFeatureGate itemId="dues_statement" label="Statement of Account"><StatementPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dues/penalties" element={<ProtectedRoute><MenuFeatureGate itemId="dues_penalties" label="Late Payment Penalty"><PenaltyRunPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/dues/upi-claims" element={<ProtectedRoute><MenuFeatureGate itemId="dues_upi_claims" label="UPI Payments"><UpiClaimsPage /></MenuFeatureGate></ProtectedRoute>} />}
        {/* other-receipts is orphaned from NAV_GROUPS (no menu item), so it
            keeps its fixed role list unchanged. */}
        {!IS_NATIVE && <Route path="/dues/other-receipts" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><OtherReceiptsPage /></RoleRoute>} />}

        {/* Expenses */}
        {!IS_NATIVE && <Route path="/expenses" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><ExpenseListPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/dashboard" element={<RoleRoute roles={['TREASURER', 'COMMITTEE']}><ExpenseDashboardPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/categories" element={<RoleRoute roles={['TREASURER', 'MANAGER']}><ExpenseCategoriesPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/recurring" element={<ProtectedRoute><MenuFeatureGate itemId="recurring_expenses" label="Recurring Expenses"><RecurringExpensesPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/transparency" element={<ProtectedRoute><TransparencyPage /></ProtectedRoute>} />}

        {/* Announcements */}
        {!IS_NATIVE && <Route path="/announcements" element={<ProtectedRoute><AnnouncementFeedPage /></ProtectedRoute>} />}
        <Route path="/documents" element={<ProtectedRoute><DocumentRepositoryPage /></ProtectedRoute>} />

        {/* Visitors */}
        {/* visitors_log was the widest-reaching mismatch found in the audit
            behind this change: the nav item always claimed every role could
            see it, and the backend GET has never restricted it either, but
            this RoleRoute alone was quietly narrower than both — Resident/
            Committee/Treasurer saw the sidebar link and got bounced right
            back. Fixed by matching what was already true everywhere else. */}
        {!IS_NATIVE && <Route path="/visitors" element={<ProtectedRoute><MenuFeatureGate itemId="visitors_log" label="Visitor Log"><VisitorLogPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/visitors/preapprove" element={<RoleRoute roles={['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER']}><PreApproveVisitorPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/visitors/requests" element={<RoleRoute roles={['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER']}><VisitorRequestsPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/gate" element={<ProtectedRoute><MenuFeatureGate itemId="visitors_gate" label="Gate Dashboard"><GateDashboardPage /></MenuFeatureGate></ProtectedRoute>} />}

        {/* Admin */}
        {!IS_NATIVE && <Route path="/admin/units" element={<RoleRoute roles={['MANAGER']}><UnitManagementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/units/:id" element={<RoleRoute roles={['MANAGER']}><UnitDetailPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/users" element={<RoleRoute roles={['MANAGER']}><UserManagementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/associations" element={<RoleRoute roles={['SUPER_USER']}><AssociationManagementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/associations/:id" element={<RoleRoute roles={['SUPER_USER']}><AssociationDetailPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/subscriptions" element={<RoleRoute roles={['SUPER_USER']}><SubscriptionsPage /></RoleRoute>} />}

        {/* Governance. Organisers manage meetings; every resident sees /meetings
            and votes there. Module entitlement is enforced server-side. */}
        {!IS_NATIVE && <Route path="/governance/meetings" element={<ProtectedRoute><MenuFeatureGate itemId="gov_meetings" label="Meetings"><MeetingsPage /></MenuFeatureGate></ProtectedRoute>} />}
        {/* Detail sub-route isn't its own menu item (reached via a link from
            the list, not the sidebar) and its backend GET wasn't converted,
            so it keeps gov_meetings' fixed role list rather than getting
            ahead of what's actually enforced. */}
        {!IS_NATIVE && <Route path="/governance/meetings/:id" element={<RoleRoute roles={['MANAGER', 'COMMITTEE', 'SUPER_USER']}><MeetingDetailPage /></RoleRoute>} />}
        {/* gov_committees and gov_register keep their fixed role lists — their
            backend GETs are open-by-design (committees) or shared with the
            elections page (register), so neither converts cleanly to a
            single menu-feature gate. */}
        {!IS_NATIVE && <Route path="/governance/committees" element={<RoleRoute roles={['MANAGER', 'COMMITTEE', 'SUPER_USER']}><CommitteesPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/governance/register" element={<RoleRoute roles={['MANAGER', 'COMMITTEE', 'SUPER_USER']}><RegisterPage /></RoleRoute>} />}
        {/* Every member can reach elections: standing, seconding and voting
            are things a member does, not an organiser. */}
        {!IS_NATIVE && <Route path="/governance/elections" element={<ProtectedRoute><ElectionsPage /></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/governance/compliance" element={<ProtectedRoute><MenuFeatureGate itemId="gov_compliance" label="Compliance Calendar"><CompliancePage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/meetings" element={<ProtectedRoute><MyMeetingsPage /></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/admin/web-menu" element={<ProtectedRoute><MenuFeatureGate itemId="system_web_menu" label="Web Menu by Role"><WebMenuPage /></MenuFeatureGate></ProtectedRoute>} />}
        {/* Old path kept so existing bookmarks still land somewhere. */}
        {!IS_NATIVE && <Route path="/admin/menu-config" element={<ProtectedRoute><MenuFeatureGate itemId="system_web_menu" label="Web Menu by Role"><WebMenuPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/admin/mobile-menu" element={<ProtectedRoute><MenuFeatureGate itemId="system_mobile_menu" label="Mobile Menu by Role"><MobileMenuPage /></MenuFeatureGate></ProtectedRoute>} />}
        {/* The old per-association matrix wrote the same column in a shape that
            had no role dimension, so leaving it reachable meant one screen could
            silently undo the other. Same page now. */}
        {!IS_NATIVE && <Route path="/admin/mobile-config" element={<ProtectedRoute><MenuFeatureGate itemId="system_mobile_menu" label="Mobile Menu by Role"><MobileMenuPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/admin/branding" element={<ProtectedRoute><MenuFeatureGate itemId="system_branding" label="Branding"><BrandingPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/admin/audit-log" element={<ProtectedRoute><MenuFeatureGate itemId="system_audit_log" label="Audit Trail"><AuditLogPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/reports/insights" element={<ProtectedRoute><MenuFeatureGate itemId="reports_insights" label="Insights"><InsightsPage /></MenuFeatureGate></ProtectedRoute>} />}

        {/* Transactions */}
        {!IS_NATIVE && <Route path="/transactions/dashboard" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><TransactionsDashboardPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/transactions/reports"   element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><ReportsPage /></RoleRoute>} />}

        {/* Accounting */}
        {/* chart_of_accounts and business_partners keep their fixed role list:
            both backend GETs are shared master-data lookups (vendor/account
            pickers reused by Expenses, Recurring Expenses, Journal Entries,
            Ledger), so gating them on one page's menu item would break those
            other pages for any role that has them but not this one. Every
            report below is a single page's own exclusive data call, so those
            convert cleanly. */}
        {!IS_NATIVE && <Route path="/accounting/chart-of-accounts" element={<RoleRoute roles={['MANAGER', 'TREASURER']}><ChartOfAccountsPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/business-partners"  element={<RoleRoute roles={['MANAGER', 'TREASURER']}><BusinessPartnersPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/journal"            element={<ProtectedRoute><MenuFeatureGate itemId="journal_entries" label="Journal Entries"><JournalEntriesPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/ledger"             element={<ProtectedRoute><MenuFeatureGate itemId="ledger" label="Ledger"><LedgerPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/pnl"               element={<ProtectedRoute><MenuFeatureGate itemId="pnl" label="Profit & Loss"><PnLPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/balance-sheet"     element={<ProtectedRoute><MenuFeatureGate itemId="balance_sheet" label="Balance Sheet"><BalanceSheetPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/trial-balance"     element={<ProtectedRoute><MenuFeatureGate itemId="trial_balance" label="Trial Balance"><TrialBalancePage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/cash-book"         element={<ProtectedRoute><MenuFeatureGate itemId="cash_book" label="Cash / Bank Book"><CashBookPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/day-book"          element={<ProtectedRoute><MenuFeatureGate itemId="day_book" label="Day Book"><DayBookPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/receipts-payments" element={<ProtectedRoute><MenuFeatureGate itemId="receipts_payments" label="Receipts & Payments"><ReceiptsPaymentsPage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/income-expenditure" element={<ProtectedRoute><MenuFeatureGate itemId="income_expenditure" label="Income & Expenditure"><IncomeExpenditurePage /></MenuFeatureGate></ProtectedRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/fy-closure"        element={<ProtectedRoute><MenuFeatureGate itemId="fy_closure" label="FY Closure"><FYClosurePage /></MenuFeatureGate></ProtectedRoute>} />}

        {/* change-mpin is available on web; mobile version is inside the MobileLayout block above */}
        {!IS_NATIVE && <Route path="/change-mpin" element={<ProtectedRoute><ChangeMpinPage /></ProtectedRoute>} />}
        {/* Catch-all: 404 on web, redirect on mobile (handled by the MobileLayout block above) */}
        {!IS_NATIVE && <Route path="*" element={<NotFoundPage />} />}
      </Routes>
      </MobileConfigProvider>
    </BrowserRouter>
  );
}
