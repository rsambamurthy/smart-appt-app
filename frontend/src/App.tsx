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
import AnnouncementFeedPage from './pages/announcements/AnnouncementFeedPage';
import DocumentRepositoryPage from './pages/announcements/DocumentRepositoryPage';
import VisitorLogPage from './pages/visitors/VisitorLogPage';
import GateDashboardPage from './pages/visitors/GateDashboardPage';
import PreApproveVisitorPage from './pages/visitors/PreApproveVisitorPage';
import UnitManagementPage from './pages/admin/UnitManagementPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import UnitDetailPage from './pages/admin/UnitDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterAssociationPage from './pages/RegisterAssociationPage';
import AssociationManagementPage from './pages/admin/AssociationManagementPage';
import AssociationDetailPage from './pages/admin/AssociationDetailPage';
import OneTimeDuesPage from './pages/dues/OneTimeDuesPage';
import OtherReceiptsPage from './pages/receipts/OtherReceiptsPage';
import MenuConfigPage from './pages/admin/MenuConfigPage';
import ChangeMpinPage from './pages/ChangeMpinPage';
import TransactionsDashboardPage from './pages/transactions/TransactionsDashboardPage';
import ReportsPage from './pages/transactions/ReportsPage';
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage';
import JournalEntriesPage from './pages/accounting/JournalEntriesPage';
import LedgerPage from './pages/accounting/LedgerPage';
import PnLPage from './pages/accounting/PnLPage';
import BalanceSheetPage from './pages/accounting/BalanceSheetPage';

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
            <Route path="/mobile/visitors" element={<ProtectedRoute><MobileVisitorsPage /></ProtectedRoute>} />
            <Route path="/mobile/visitors/log" element={<ProtectedRoute><VisitorLogPage /></ProtectedRoute>} />
            <Route path="/mobile/visitors/preapprove" element={<ProtectedRoute><PreApproveVisitorPage /></ProtectedRoute>} />
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
        {!IS_NATIVE && <Route path="/dues" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><DuesDashboardPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/bills" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><DuesBillsPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/config" element={<RoleRoute roles={['TREASURER']}><DuesConfigPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/config/razorpay" element={<RoleRoute roles={['TREASURER']}><RazorpayConfigPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/my-bills" element={<RoleRoute roles={['RESIDENT']}><MyBillsPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/pay/:billId" element={<RoleRoute roles={['RESIDENT']}><PaymentPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/one-time-dues" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><OneTimeDuesPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/dues/other-receipts" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><OtherReceiptsPage /></RoleRoute>} />}

        {/* Expenses */}
        {!IS_NATIVE && <Route path="/expenses" element={<RoleRoute roles={['TREASURER', 'COMMITTEE']}><ExpenseListPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/dashboard" element={<RoleRoute roles={['TREASURER', 'COMMITTEE']}><ExpenseDashboardPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/categories" element={<RoleRoute roles={['TREASURER', 'MANAGER']}><ExpenseCategoriesPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/expenses/transparency" element={<ProtectedRoute><TransparencyPage /></ProtectedRoute>} />}

        {/* Announcements */}
        {!IS_NATIVE && <Route path="/announcements" element={<ProtectedRoute><AnnouncementFeedPage /></ProtectedRoute>} />}
        <Route path="/documents" element={<ProtectedRoute><DocumentRepositoryPage /></ProtectedRoute>} />

        {/* Visitors */}
        {!IS_NATIVE && <Route path="/visitors" element={<RoleRoute roles={['MANAGER', 'GATE_STAFF']}><VisitorLogPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/visitors/preapprove" element={<RoleRoute roles={['RESIDENT']}><PreApproveVisitorPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/gate" element={<RoleRoute roles={['GATE_STAFF']}><GateDashboardPage /></RoleRoute>} />}

        {/* Admin */}
        {!IS_NATIVE && <Route path="/admin/units" element={<RoleRoute roles={['MANAGER']}><UnitManagementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/units/:id" element={<RoleRoute roles={['MANAGER']}><UnitDetailPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/users" element={<RoleRoute roles={['MANAGER']}><UserManagementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/associations" element={<RoleRoute roles={['SUPER_USER']}><AssociationManagementPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/associations/:id" element={<RoleRoute roles={['SUPER_USER']}><AssociationDetailPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/admin/menu-config" element={<RoleRoute roles={['SUPER_USER']}><MenuConfigPage /></RoleRoute>} />}

        {/* Transactions */}
        {!IS_NATIVE && <Route path="/transactions/dashboard" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><TransactionsDashboardPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/transactions/reports"   element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><ReportsPage /></RoleRoute>} />}

        {/* Accounting */}
        {!IS_NATIVE && <Route path="/accounting/chart-of-accounts" element={<RoleRoute roles={['MANAGER', 'TREASURER']}><ChartOfAccountsPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/journal"            element={<RoleRoute roles={['MANAGER', 'TREASURER', 'COMMITTEE']}><JournalEntriesPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/ledger"             element={<RoleRoute roles={['MANAGER', 'TREASURER', 'COMMITTEE']}><LedgerPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/pnl"               element={<RoleRoute roles={['MANAGER', 'TREASURER', 'COMMITTEE']}><PnLPage /></RoleRoute>} />}
        {!IS_NATIVE && <Route path="/accounting/balance-sheet"     element={<RoleRoute roles={['MANAGER', 'TREASURER', 'COMMITTEE']}><BalanceSheetPage /></RoleRoute>} />}

        {/* change-mpin is available on web; mobile version is inside the MobileLayout block above */}
        {!IS_NATIVE && <Route path="/change-mpin" element={<ProtectedRoute><ChangeMpinPage /></ProtectedRoute>} />}
        {/* Catch-all: 404 on web, redirect on mobile (handled by the MobileLayout block above) */}
        {!IS_NATIVE && <Route path="*" element={<NotFoundPage />} />}
      </Routes>
      </MobileConfigProvider>
    </BrowserRouter>
  );
}
