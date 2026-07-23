import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDuesDashboardQuery } from '../../store/api/duesApi';
import { useGetExpensesTotalQuery } from '../../store/api/expensesApi';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SummaryCard {
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
  icon: string;
}

function Card({ label, value, sub, color, bg, icon }: SummaryCard) {
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
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

export default function TransactionsDashboardPage() {
  const { data: duesData, isLoading: duesLoading } = useGetDuesDashboardQuery();
  const { data: expData,  isLoading: expLoading  } = useGetExpensesTotalQuery();

  const dues    = duesData?.data as Record<string, number | null> | undefined;
  const opening = dues?.cash_balance ?? null;
  const collected = dues?.total_collected ?? null;
  const expenses  = expData?.data?.total_expenses ?? null;

  const closing =
    opening != null && collected != null && expenses != null
      ? Number(opening) + Number(collected) - Number(expenses)
      : null;

  const isLoading = duesLoading || expLoading;

  const asOn = (dues as Record<string, unknown> | undefined)?.cash_balance_as_on
    ? new Date(String((dues as Record<string, unknown>).cash_balance_as_on)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Transactions' }, { label: 'Dashboard' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>
        {isLoading ? (
          <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}>
              <Card
                label="Opening Balance"
                value={fmt(opening)}
                sub={asOn ? `As on ${asOn}` : 'From Fee Configuration'}
                color="#0095db"
                bg="#e0f2fe"
                icon="🏦"
              />
              <Card
                label="Total Collections"
                value={fmt(collected)}
                sub="Bills payments + Other receipts"
                color="#16a34a"
                bg="#dcfce7"
                icon="📥"
              />
              <Card
                label="Total Expenses"
                value={fmt(expenses)}
                sub="Approved + Recorded expenses"
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

            {/* Ledger summary table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 520 }}>
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ledger Summary
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <tbody>
                  {[
                    { label: 'Opening Balance', value: fmt(opening), bold: false, color: '#0095db' },
                    { label: 'Add: Total Collections', value: fmt(collected), bold: false, color: '#16a34a' },
                    { label: 'Less: Total Expenses', value: fmt(expenses), bold: false, color: '#dc2626' },
                  ].map((row) => (
                    <tr key={row.label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.65rem 1.25rem', color: 'var(--color-text)' }}>{row.label}</td>
                      <td style={{ padding: '0.65rem 1.25rem', textAlign: 'right', fontWeight: 600, color: row.color }}>{row.value}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--color-primary)', }}>
                    <td style={{ padding: '0.75rem 1.25rem', color: '#fff', fontWeight: 700 }}>Closing Balance</td>
                    <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{fmt(closing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
