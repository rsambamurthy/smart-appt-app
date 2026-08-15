import { MyStatementPage } from '../dues/StatementPage';

// Same statement view as web — Layout already collapses to a pass-through
// shell on native, so the desktop page renders correctly here as-is.
export default function MobileStatementPage() {
  return <MyStatementPage />;
}
