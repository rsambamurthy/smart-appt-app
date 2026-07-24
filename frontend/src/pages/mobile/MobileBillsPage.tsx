import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import MyBillsPage from '../dues/MyBillsPage';
import DuesBillsPage from '../dues/DuesBillsPage';

/**
 * Bills hub — shows MyBillsPage for residents, DuesBillsPage for staff/managers.
 * Both pages already use <Layout> which is a passthrough on native.
 */
export default function MobileBillsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  if (user?.role === 'RESIDENT') return <MyBillsPage />;
  return <DuesBillsPage />;
}
