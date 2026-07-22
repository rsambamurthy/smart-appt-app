import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetTransparencyQuery } from '../../store/api/expensesApi';

interface TransparencyExpense {
  id: string;
  expense_date: string;
  category: string;
  vendor_name?: string;
  amount: number;
  payment_mode: string;
  description?: string;
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function TransparencyPage() {
  const { data, isLoading } = useGetTransparencyQuery();
  const expenses = (data?.data ?? []) as TransparencyExpense[];

  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  const categories = Array.from(new Set(expenses.map((e) => e.category))).sort();

  const filtered = expenses.filter((e) => {
    if (filterCategory && e.category !== filterCategory) return false;
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

  const totalSpent = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Expenses', to: '/expenses' }, { label: 'Transparency' }]} />

      <div style={{ padding: '1.5rem 2rem' }}>
        {/* Summary banner */}
        <div className="ent-meta" style={{ marginBottom: '1.5rem' }}>
          <div>
            <div className="ent-meta-label">Total Expenses Shown</div>
            <div className="ent-meta-value" style={{ fontWeight: 700, fontSize: '1.1rem', color: '#dc2626' }}>
              ₹{totalSpent.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="ent-meta-label">Transactions</div>
            <div className="ent-meta-value" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{filtered.length}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="ent-section" style={{ marginBottom: '1.25rem' }}>
          <div className="ent-toolbar" style={{ padding: '0.75rem 1.25rem', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              className="ent-fc"
              style={{ flex: '1 1 160px' }}
              placeholder="Search vendor / description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="ent-fc"
              style={{ width: 180 }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filterCategory || search) && (
              <button
                onClick={() => { setFilterCategory(''); setSearch(''); }}
                style={{ padding: '0 10px', height: 30, border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">Expense Transactions</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Approved & recorded expenses visible to all residents</span>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
              No expense records found.
            </div>
          ) : (
            <div className="ent-page-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Vendor / Description</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                        {fmt(e.expense_date)}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                          fontSize: '0.78rem', fontWeight: 600,
                          background: 'var(--theme-accent-light)', color: 'var(--theme-accent)',
                        }}>
                          {e.category}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{e.vendor_name ?? '—'}</div>
                        {e.description && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{e.description}</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{e.payment_mode}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(e.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f7f9fd', borderTop: '2px solid var(--color-border)' }}>
                    <td colSpan={4} style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.875rem' }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626', padding: '0.6rem 0.75rem' }}>
                      ₹{totalSpent.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
