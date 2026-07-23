import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDuesDashboardQuery } from '../../store/api/duesApi';

function fmt(val: unknown) {
  const n = Number(val ?? 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function now() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
  icon: string;
}

function StatCard({ label, value, sub, color, bg, icon }: StatCardProps) {
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

export default function DuesDashboardPage() {
  const [tab, setTab] = useState<Tab>('month');
  const { data: dash, isLoading } = useGetDuesDashboardQuery();
  const d = dash?.data as Record<string, unknown> | undefined;

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

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues & Payments' }, { label: 'Overview' }]} />

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
              {tabBtn('month', `This Month (${now()})`)}
              {tabBtn('overall', 'Overall')}
            </div>

            {/* This Month */}
            {tab === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <StatCard
                  label="Total Billed"
                  value={fmt(d?.month_billed)}
                  sub="Bills generated this month"
                  color="#185FA5"
                  bg="#e0f2fe"
                  icon="🧾"
                />
                <StatCard
                  label="Total Collected"
                  value={fmt(d?.month_collected)}
                  sub="Payments received this month"
                  color="#3B6D11"
                  bg="#dcfce7"
                  icon="📥"
                />
                <StatCard
                  label="Total Arrears"
                  value={fmt(d?.month_arrears)}
                  sub="Outstanding for this month"
                  color="#A32D2D"
                  bg="#fee2e2"
                  icon="⚠️"
                />
              </div>
            )}

            {/* Overall */}
            {tab === 'overall' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <StatCard
                  label="Total Billed"
                  value={fmt(d?.total_billed)}
                  sub="All bills ever generated"
                  color="#185FA5"
                  bg="#e0f2fe"
                  icon="🧾"
                />
                <StatCard
                  label="Total Collected"
                  value={fmt(d?.total_billing_collected)}
                  sub="All billing payments received"
                  color="#3B6D11"
                  bg="#dcfce7"
                  icon="📥"
                />
                <StatCard
                  label="Total Arrears"
                  value={fmt(d?.total_arrears)}
                  sub="Total outstanding balance"
                  color="#A32D2D"
                  bg="#fee2e2"
                  icon="⚠️"
                />
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
