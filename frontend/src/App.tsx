import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterAssociationPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        {/* Maintenance */}
        <Route path="/maintenance" element={<ProtectedRoute><TicketListPage /></ProtectedRoute>} />
        <Route path="/maintenance/new" element={<ProtectedRoute><RaiseTicketPage /></ProtectedRoute>} />
        <Route path="/maintenance/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />

        {/* Dues */}
        <Route path="/dues" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><DuesDashboardPage /></RoleRoute>} />
        <Route path="/dues/bills" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><DuesBillsPage /></RoleRoute>} />
        <Route path="/dues/config" element={<RoleRoute roles={['TREASURER']}><DuesConfigPage /></RoleRoute>} />
        <Route path="/config/razorpay" element={<RoleRoute roles={['TREASURER']}><RazorpayConfigPage /></RoleRoute>} />
        <Route path="/dues/my-bills" element={<RoleRoute roles={['RESIDENT']}><MyBillsPage /></RoleRoute>} />
        <Route path="/dues/pay/:billId" element={<RoleRoute roles={['RESIDENT']}><PaymentPage /></RoleRoute>} />
        <Route path="/dues/one-time-dues" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><OneTimeDuesPage /></RoleRoute>} />
        <Route path="/dues/other-receipts" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><OtherReceiptsPage /></RoleRoute>} />

        {/* Expenses */}
        <Route path="/expenses" element={<RoleRoute roles={['TREASURER', 'COMMITTEE']}><ExpenseListPage /></RoleRoute>} />
        <Route path="/expenses/dashboard" element={<RoleRoute roles={['TREASURER', 'COMMITTEE']}><ExpenseDashboardPage /></RoleRoute>} />
        <Route path="/expenses/categories" element={<RoleRoute roles={['TREASURER', 'MANAGER']}><ExpenseCategoriesPage /></RoleRoute>} />
        <Route path="/expenses/transparency" element={<ProtectedRoute><TransparencyPage /></ProtectedRoute>} />

        {/* Announcements */}
        <Route path="/announcements" element={<ProtectedRoute><AnnouncementFeedPage /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><DocumentRepositoryPage /></ProtectedRoute>} />

        {/* Visitors */}
        <Route path="/visitors" element={<RoleRoute roles={['MANAGER', 'GATE_STAFF']}><VisitorLogPage /></RoleRoute>} />
        <Route path="/visitors/preapprove" element={<RoleRoute roles={['RESIDENT']}><PreApproveVisitorPage /></RoleRoute>} />
        <Route path="/gate" element={<RoleRoute roles={['GATE_STAFF']}><GateDashboardPage /></RoleRoute>} />

        {/* Admin */}
        <Route path="/admin/units" element={<RoleRoute roles={['MANAGER']}><UnitManagementPage /></RoleRoute>} />
        <Route path="/admin/units/:id" element={<RoleRoute roles={['MANAGER']}><UnitDetailPage /></RoleRoute>} />
        <Route path="/admin/users" element={<RoleRoute roles={['MANAGER']}><UserManagementPage /></RoleRoute>} />
        <Route path="/admin/associations" element={<RoleRoute roles={['SUPER_USER']}><AssociationManagementPage /></RoleRoute>} />
        <Route path="/admin/associations/:id" element={<RoleRoute roles={['SUPER_USER']}><AssociationDetailPage /></RoleRoute>} />
        <Route path="/admin/menu-config" element={<RoleRoute roles={['SUPER_USER']}><MenuConfigPage /></RoleRoute>} />

        {/* Transactions */}
        <Route path="/transactions/dashboard" element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><TransactionsDashboardPage /></RoleRoute>} />
        <Route path="/transactions/reports"   element={<RoleRoute roles={['TREASURER', 'COMMITTEE', 'MANAGER']}><ReportsPage /></RoleRoute>} />

        {/* Accounting */}
        <Route path="/accounting/chart-of-accounts" element={<RoleRoute roles={['MANAGER', 'TREASURER']}><ChartOfAccountsPage /></RoleRoute>} />
        <Route path="/accounting/journal"            element={<RoleRoute roles={['MANAGER', 'TREASURER', 'COMMITTEE']}><JournalEntriesPage /></RoleRoute>} />

        <Route path="/change-mpin" element={<ProtectedRoute><ChangeMpinPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
