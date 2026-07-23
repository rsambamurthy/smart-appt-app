import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListAccountsQuery, useGetLedgerQuery,
  Account,
} from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt  = (n: number) => n === 0 ? '—' : `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const TYPE_META: Record<string, { label: string; color: string }> = {
  ASSET:     { label: 'Asset',     color: '#2563eb' },
  LIABILITY: { label: 'Liability', color: '#dc2626' },
  INCOME:    { label: 'Income',    color: '#16a34a' },
  EXPENSE:   { label: 'Expense',   color: '#d97706' },
  EQUITY:    { label: 'Equity',    color: '#7c3aed' },
};

const REF_LABELS: Record<string, string> = {
  DUES_BILL:    'Bill',
  PAYMENT:      'Payment',
  EXPENSE:      'Expense',
  OTHER_RECEIPT:'Receipt',
  MANUAL:       'Manual',
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'] as const;

const fc: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none',
};

// ── Balance display ───────────────────────────────────────────────────────────
function BalanceCell({ value, isDebitNormal }: { value: number; isDebitNormal: boolean }) {
  if (value === 0) return <span style={{ color: '#94a3b8' }}>Nil</span>;
  const label = value > 0 ? (isDebitNormal ? 'Dr' : 'Cr') : (isDebitNormal ? 'Cr' : 'Dr');
  const color = label === 'Dr' ? '#2563eb' : '#16a34a';
  return (
    <span>
      {fmtAmt(value)}{' '}
      <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{label}</span>
    </span>
  );
}

export default function LedgerPage() {
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const [applied, setApplied] = useState<{ accountId: string; from: string; to: string } | null>(null);

  const { data: accountsData } = useListAccountsQuery();
  const accounts = accountsData?.data ?? [];

  const { data: ledgerData, isLoading, isFetching } = useGetLedgerQuery(
    { account_id: applied?.accountId ?? '', from: applied?.from, to: applied?.to },
    { skip: !applied?.accountId }
  );

  const ledger       = ledgerData?.data;
  const selectedAcct = accounts.find(a => a.id === accountId);

  const handleView = () => {
    if (!accountId) return;
    setApplied({ accountId, from, to });
  };

  const handlePrint = () => window.print();

  // Group accounts by type for the select
  const grouped = TYPE_ORDER.reduce((acc, t) => {
    acc[t] = accounts.filter(a => a.type === t);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Ledger' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 900 }}>

        {/* Filter bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Account</label>
              <select style={{ ...fc, width: '100%' }} value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">— Select account —</option>
                {TYPE_ORDER.map(type => (
                  <optgroup key={type} label={`${TYPE_META[type].label}s`}>
                    {grouped[type].map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>From</label>
              <input type="date" style={fc} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>To</label>
              <input type="date" style={fc} value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button
              onClick={handleView}
              disabled={!accountId}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: accountId ? 'pointer' : 'not-allowed', opacity: accountId ? 1 : 0.5 }}
            >
              View Ledger
            </button>
          </div>
        </div>

        {/* Ledger */}
        {isLoading || isFetching ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Loading ledger…</div>
        ) : !ledger ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Select an account above to view its ledger.
          </div>
        ) : (
          <>
            {/* Account header */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#64748b' }}>{ledger.account.code}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{ledger.account.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99,
                    background: '#f1f5f9', color: TYPE_META[ledger.account.type]?.color ?? '#475569',
                  }}>
                    {TYPE_META[ledger.account.type]?.label ?? ledger.account.type}
                  </span>
                  {ledger.account.sub_type && (
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>· {ledger.account.sub_type}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {applied?.from || applied?.to
                    ? `Period: ${applied.from ? fmtDate(applied.from) : 'beginning'} — ${applied.to ? fmtDate(applied.to) : 'today'}`
                    : 'All time'}
                  {' · '}{ledger.rows.length} transaction{ledger.rows.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button onClick={handlePrint} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
              </button>
            </div>

            {/* Ledger table */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', width: 100 }}>Date</th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Narration</th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', width: 90 }}>Ref</th>
                    <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 10.5, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em', width: 120 }}>Debit (Dr)</th>
                    <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 10.5, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', width: 120 }}>Credit (Cr)</th>
                    <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 10.5, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', width: 140 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  {applied?.from && (
                    <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                      <td style={{ padding: '9px 14px', color: '#92400e', fontSize: 12, fontWeight: 600 }}>{fmtDate(applied.from)}</td>
                      <td style={{ padding: '9px 14px', color: '#92400e', fontSize: 12, fontWeight: 600 }} colSpan={4}>Opening Balance</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#92400e' }}>
                        <BalanceCell value={ledger.openingBalance} isDebitNormal={ledger.isDebitNormal} />
                      </td>
                    </tr>
                  )}

                  {ledger.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                        No transactions in this period.
                      </td>
                    </tr>
                  ) : (
                    ledger.rows.map((row, idx) => (
                      <tr key={row.id} style={{ borderTop: idx === 0 && !applied?.from ? 'none' : '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDate(row.entry_date)}</td>
                        <td style={{ padding: '9px 14px', color: '#1e293b' }}>
                          {row.narration}
                          <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: row.entry_type === 'AUTO' ? '#2563eb' : '#7c3aed', background: row.entry_type === 'AUTO' ? '#eff6ff' : '#f5f3ff', padding: '1px 5px', borderRadius: 4 }}>
                            {row.entry_type === 'AUTO' ? 'Auto' : 'Manual'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12 }}>
                          {row.reference_type ? REF_LABELS[row.reference_type] ?? row.reference_type : '—'}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: row.debit > 0 ? 600 : 400, color: row.debit > 0 ? '#2563eb' : '#94a3b8' }}>
                          {fmtAmt(row.debit)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: row.credit > 0 ? 600 : 400, color: row.credit > 0 ? '#16a34a' : '#94a3b8' }}>
                          {fmtAmt(row.credit)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                          <BalanceCell value={row.balance} isDebitNormal={ledger.isDebitNormal} />
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Closing balance row */}
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={3} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#475569' }}>
                      {applied?.to ? `Closing Balance as of ${fmtDate(applied.to)}` : 'Closing Balance'}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                      {ledger.rows.reduce((s, r) => s + r.debit, 0) > 0
                        ? fmtAmt(ledger.rows.reduce((s, r) => s + r.debit, 0)) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      {ledger.rows.reduce((s, r) => s + r.credit, 0) > 0
                        ? fmtAmt(ledger.rows.reduce((s, r) => s + r.credit, 0)) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                      <BalanceCell value={ledger.closingBalance} isDebitNormal={ledger.isDebitNormal} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, aside, button, [class*="sidebar"], [class*="header"] { display: none !important; }
          body { background: white; }
          table { font-size: 11pt; }
        }
      `}</style>
    </Layout>
  );
}
