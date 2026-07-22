import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetTransparencyQuery, useListExpenseCategoriesQuery } from '../../store/api/expensesApi';
import { useGetDuesDashboardQuery } from '../../store/api/duesApi';

interface TransparencyExpense {
  id: string;
  expense_date: string;
  category: string;
  vendor_name?: string;
  amount: number;
  payment_mode: string;
  description?: string;
}

interface Category { id: string; name: string; display_name: string; color: string; is_active: boolean }

export default function TransparencyPage() {
  const { data, isLoading } = useGetTransparencyQuery();
  const expenses = (data?.data ?? []) as TransparencyExpense[];

  const { data: catData } = useListExpenseCategoriesQuery();
  const categories = (catData?.data ?? []) as Category[];
  const activeCats = categories.filter((c) => c.is_active);

  const { data: dashData } = useGetDuesDashboardQuery();
  const dash = dashData?.data as Record<string, unknown> | undefined;
  const openingBalance = dash ? Number(dash['cash_balance'] ?? 0) : 0;
  const openingBalanceAsOn = dash?.['cash_balance_as_on'] as string | undefined;
  const totalCollections = dash ? Number(dash['total_collected'] ?? 0) : 0;

  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  const filtered = expenses.filter((e) => {
    if (filterCategory && e.category !== filterCategory) return false;
    if (filterDateFrom && e.expense_date < filterDateFrom) return false;
    if (filterDateTo && e.expense_date.slice(0, 10) > filterDateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.category.toLowerCase().includes(q) ||
        (e.vendor_name ?? '').toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCat = (name: string) => categories.find((x) => x.name === name) ?? { display_name: name, color: '#9ca3af' };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Expenses', to: '/expenses' }, { label: 'Transparency' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* ── Balance Ledger ── */}
        {openingBalance > 0 && (() => {
          const totalExpenses = filtered.reduce((s, e) => s + Number(e.amount), 0);
          const closingBalance = openingBalance + totalCollections - totalExpenses;
          return (
            <div className="ent-meta" style={{ marginBottom: '1.25rem' }}>
              <div>
                <div className="ent-meta-label">
                  Opening Balance{openingBalanceAsOn ? ` (as on ${new Date(openingBalanceAsOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}
                </div>
                <div className="ent-meta-value" style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>
                  ₹{openingBalance.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="ent-meta-label">Total Collections</div>
                <div className="ent-meta-value" style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>
                  + ₹{totalCollections.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="ent-meta-label">Total Expenses ({filtered.length} transactions)</div>
                <div className="ent-meta-value" style={{ fontWeight: 700, fontSize: '1.1rem', color: '#dc2626' }}>
                  − ₹{totalExpenses.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="ent-meta-label">Closing Balance</div>
                <div className="ent-meta-value" style={{
                  fontWeight: 700, fontSize: '1.1rem',
                  color: closingBalance >= 0 ? '#16a34a' : '#dc2626',
                }}>
                  ₹{closingBalance.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Toolbar */}
        <div className="ent-section" style={{ marginBottom: '1.25rem' }}>
          <div className="ent-toolbar" style={{ padding: '0.75rem 1.25rem', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input className="ent-fc" style={{ flex: '1 1 160px' }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="ent-fc" style={{ width: 160 }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {activeCats.map((c) => <option key={c.name} value={c.name}>{c.display_name}</option>)}
            </select>
            <input className="ent-fc" type="date" style={{ width: 135 }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} title="From" />
            <input className="ent-fc" type="date" style={{ width: 135 }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} title="To" />
            {(filterCategory || filterDateFrom || filterDateTo || search) && (
              <button onClick={() => { setFilterCategory(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); }}
                style={{ padding: '0 10px', height: 30, border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer' }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {isLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
              No expenses found.
            </div>
          ) : (
            <div className="ent-page-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Category</th><th>Vendor / Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th><th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const cat = getCat(e.category);
                    return (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                          {new Date(e.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px',
                            borderRadius: 4, fontSize: '0.78rem', fontWeight: 600,
                            background: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44`,
                          }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
                            {cat.display_name}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{e.vendor_name ?? '—'}</div>
                          {e.description && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{e.description}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(e.amount).toLocaleString()}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{e.payment_mode}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
