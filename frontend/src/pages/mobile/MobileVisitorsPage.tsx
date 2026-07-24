import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import PreApproveVisitorPage from '../visitors/PreApproveVisitorPage';
import VisitorLogPage from '../visitors/VisitorLogPage';

/**
 * Visitors hub — shows PreApproveVisitorPage for residents, VisitorLogPage for staff/managers.
 */
export default function MobileVisitorsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  if (user?.role === 'RESIDENT') return <PreApproveVisitorPage />;
  return <VisitorLogPage />;
}
