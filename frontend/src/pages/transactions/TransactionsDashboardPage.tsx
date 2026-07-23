import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDuesDashboardQuery } from '../../store/api/duesApi';
import { useGetExpensesTotalQuery } from '../../store/api/expensesApi';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nowLabel() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
  icon: string;
}

function Card({ label, value, sub, color, bg, icon }: CardProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.4rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: '1.45rem', fontWeight: 700, color, lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

type Tab = 'month' | 'overall';

export default function TransactionsDashboardPage() {
  const [tab, setTab] = useState<Tab>('month');

  const { data: duesData, isLoading: duesLoading } = useGetDuesDashboardQuery();
  const { data: expData,  isLoading: expLoading  } = useGetExpensesTotalQuery();

  const dues = duesData?.data as Record<string, number | null> | undefined;
  const exp  = expData?.data;

  const opening = dues?.cash_balance ?? null;
  const asOn = (dues as Record<string, unknown> | undefined)?.cash_balance_as_on
    ? new Date(String((dues as Record<string, unknown>).cash_balance_as_on)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  // This month
  const monthCollections =
    dues?.month_collected != null && dues?.month_other_receipts != null
      ? Number(dues.month_collected) + Number(dues.month_other_receipts)
      : null;
  const monthExpenses = exp?.month_expenses ?? null;
  const monthClosing =
    opening != null && monthCollections != null && monthExpenses != null
      ? Number(opening) + monthCollections - monthExpenses
      : null;

  // Overall
  const totalCollections = dues?.total_collected ?? null;
  const totalExpenses = exp?.total_expenses ?? null;
  const totalClosing =
    opening != null && totalCollections != null && totalExpenses != null
      ? Number(opening) + Number(totalCollections) - Number(totalExpenses)
      : null;

  const isLoading = duesLoading || expLoading;

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1,
        padding: '0.6rem 1rem',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.875rem',
        borderRadius: 0,
        transition: 'all 0.15s',
        background: tab === t ? 'var(--color-primary)' : 'var(--color-bg-card)',
        color: tab === t ? '#fff' : 'var(--color-text-secondary)',
      }}
    >
      {label}
    </button>
  );

  const cards = (
    ob: number | null,
    collections: number | null,
    expenses: number | null,
    closing: number | null,
    collectionsSub: string,
    expensesSub: string,
  ) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      <Card
        label="Opening Balance"
        value={fmt(ob)}
        sub={asOn ? `As on ${asOn}` : 'From Fee Configuration'}
        color="#0095db"
        bg="#e0f2fe"
        icon="🏦"
      />
      <Card
        label="Total Collections"
        value={fmt(collections)}
        sub={collectionsSub}
        color="#16a34a"
        bg="#dcfce7"
        icon="📥"
      />
      <Card
        label="Total Expenses"
        value={fmt(expenses)}
        sub={expensesSub}
        color="#dc2626"
        bg="#fee2e2"
        icon="📤"
      />
      <Card
        label="Closing Balance"
        value={fmt(closing)}
        sub="Opening + Collections − Expenses"
        color={closing != null && closing < 0 ? '#dc2626' : '#7c3aed'}
        bg={closing != null && closing < 0 ? '#fee2e2' : '#ede9fe'}
        icon={closing != null && closing < 0 ? '⚠️' : '💰'}
      />
    </div>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Transactions' }, { label: 'Dashboard' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>
        {isLoading ? (
          <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : (
          <>
            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: '1.5rem',
              maxWidth: 320,
            }}>
              {tabBtn('month', `This Month (${nowLabel()})`)}
              {tabBtn('overall', 'Overall')}
            </div>

            {tab === 'month' && cards(
              opening,
              monthCollections,
              monthExpenses,
              monthClosing,
              'Bills + receipts this month',
              'Approved expenses this month',
            )}

            {tab === 'overall' && cards(
              opening,
              totalCollections,
              totalExpenses,
              totalClosing,
              'All bills + receipts',
              'All approved expenses',
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
