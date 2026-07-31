import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListAccountsQuery,
  useGetLedgerQuery,
  useGetAllLedgerQuery,
  useGetSubLedgerQuery,
  type Account,
  type LedgerResult,
  type SubLedgerBP,
} from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt  = (n: number) => n === 0 ? '—' : `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  ASSET:     { label: 'Asset',     color: '#2563eb', bg: '#eff6ff' },
  LIABILITY: { label: 'Liability', color: '#dc2626', bg: '#fef2f2' },
  INCOME:    { label: 'Income',    color: '#16a34a', bg: '#f0fdf4' },
  EXPENSE:   { label: 'Expense',   color: '#d97706', bg: '#fffbeb' },
  EQUITY:    { label: 'Equity',    color: '#7c3aed', bg: '#f5f3ff' },
};

const REF_LABELS: Record<string, string> = {
  DUES_BILL: 'Bill', PAYMENT: 'Payment', EXPENSE: 'Expense',
  OTHER_RECEIPT: 'Receipt', MANUAL: 'Manual',
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'] as const;

const fc: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4,
};

// ── Balance cell ─────────────────────────────────────────────────────────────
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

// ── Ledger table (reused for single account, all-accounts, and sub-ledger BPs) ─
function LedgerTable({
  rows, baseOB, openingBalance, closingBalance, isDebitNormal, from, compact,
}: {
  rows:           LedgerResult['rows'];
  baseOB:         number;
  openingBalance: number;
  closingBalance: number;
  isDebitNormal:  boolean;
  from?:          string;
  compact?:       boolean;
}) {
  const totalDr = rows.reduce((s, r) => s + r.debit,  0);
  const totalCr = rows.reduce((s, r) => s + r.credit, 0);
  const p = compact ? '6px 10px' : '9px 14px';

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 12 : 13 }}>
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          <th style={{ padding: p, textAlign: 'left',  fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', width: 90 }}>Date</th>
          <th style={{ padding: p, textAlign: 'left',  fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Narration</th>
          <th style={{ padding: p, textAlign: 'left',  fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', width: 80 }}>Ref</th>
          <th style={{ padding: p, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#2563eb',  textTransform: 'uppercase', width: 110 }}>Debit (Dr)</th>
          <th style={{ padding: p, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#16a34a',  textTransform: 'uppercase', width: 110 }}>Credit (Cr)</th>
          <th style={{ padding: p, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#475569',  textTransform: 'uppercase', width: 130 }}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {/* OB rows */}
        {!from && baseOB !== 0 && (
          <tr style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
            <td style={{ padding: p, color: '#1d4ed8', fontSize: 11.5, fontWeight: 600 }}>—</td>
            <td style={{ padding: p, color: '#1d4ed8', fontSize: 11.5, fontWeight: 600 }} colSpan={4}>Opening Balance (Brought Forward)</td>
            <td style={{ padding: p, textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>
              <BalanceCell value={baseOB} isDebitNormal={isDebitNormal} />
            </td>
          </tr>
        )}
        {from && (
          <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
            <td style={{ padding: p, color: '#92400e', fontSize: 11.5, fontWeight: 600 }}>{fmtDate(from)}</td>
            <td style={{ padding: p, color: '#92400e', fontSize: 11.5, fontWeight: 600 }} colSpan={4}>
              Opening Balance
              {baseOB !== 0 && <span style={{ fontSize: 11, fontWeight: 400, color: '#b45309', marginLeft: 6 }}>(incl. b/f: <BalanceCell value={baseOB} isDebitNormal={isDebitNormal} />)</span>}
            </td>
            <td style={{ padding: p, textAlign: 'right', fontWeight: 700, color: '#92400e' }}>
              <BalanceCell value={openingBalance} isDebitNormal={isDebitNormal} />
            </td>
          </tr>
        )}

        {rows.length === 0 ? (
          <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No transactions in this period.</td></tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: p, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(row.entry_date)}</td>
              <td style={{ padding: p, color: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span>{row.narration}</span>
                  {'business_partner' in row && row.business_partner && (
                    <span style={{ fontSize: 10.5, color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>
                      {(row as LedgerResult['rows'][0]).business_partner!.name}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, color: row.source === 'AUTO' ? '#2563eb' : '#7c3aed', background: row.source === 'AUTO' ? '#eff6ff' : '#f5f3ff', padding: '1px 5px', borderRadius: 3 }}>
                    {row.source === 'AUTO' ? 'Auto' : 'Manual'}
                  </span>
                </div>
                {row.reference_code && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>{row.reference_code}</div>}
              </td>
              <td style={{ padding: p, color: '#64748b', fontSize: 11.5 }}>{row.reference_type ? REF_LABELS[row.reference_type] ?? row.reference_type : '—'}</td>
              <td style={{ padding: p, textAlign: 'right', fontWeight: row.debit > 0 ? 600 : 400, color: row.debit > 0 ? '#2563eb' : '#94a3b8' }}>{fmtAmt(row.debit)}</td>
              <td style={{ padding: p, textAlign: 'right', fontWeight: row.credit > 0 ? 600 : 400, color: row.credit > 0 ? '#16a34a' : '#94a3b8' }}>{fmtAmt(row.credit)}</td>
              <td style={{ padding: p, textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                <BalanceCell value={row.balance} isDebitNormal={isDebitNormal} />
              </td>
            </tr>
          ))
        )}

        {/* Closing row */}
        <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
          <td colSpan={3} style={{ padding: p, fontSize: 11.5, fontWeight: 700, color: '#475569' }}>Closing Balance</td>
          <td style={{ padding: p, textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{totalDr > 0 ? fmtAmt(totalDr) : '—'}</td>
          <td style={{ padding: p, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{totalCr > 0 ? fmtAmt(totalCr) : '—'}</td>
          <td style={{ padding: p, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
            <BalanceCell value={closingBalance} isDebitNormal={isDebitNormal} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Account block (single account card used in All-Accounts view) ─────────────
function AccountBlock({ ledger, from, defaultOpen }: { ledger: LedgerResult; from?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (ledger.rows.length > 0 || ledger.baseOB !== 0));
  const meta = TYPE_META[ledger.account.type] ?? TYPE_META['ASSET'];
  const isEmpty = ledger.baseOB === 0 && ledger.closingBalance === 0 && ledger.rows.length === 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: open ? '#fff' : '#fafafa' }}
      >
        <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#94a3b8', minWidth: 60 }}>{ledger.account.code}</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{ledger.account.name}</span>
        {ledger.account.sub_type && <span style={{ fontSize: 11, color: '#94a3b8' }}>{ledger.account.sub_type}</span>}
        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: meta.bg, color: meta.color }}>{meta.label}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: isEmpty ? '#94a3b8' : '#1e293b', minWidth: 110, textAlign: 'right' }}>
          {isEmpty ? 'Nil' : <BalanceCell value={ledger.closingBalance} isDebitNormal={ledger.isDebitNormal} />}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <LedgerTable
            rows={ledger.rows}
            baseOB={ledger.baseOB}
            openingBalance={ledger.openingBalance}
            closingBalance={ledger.closingBalance}
            isDebitNormal={ledger.isDebitNormal}
            from={from}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ── BP sub-ledger block ───────────────────────────────────────────────────────
function BPBlock({ bp, isDebitNormal, from, defaultOpen }: { bp: SubLedgerBP; isDebitNormal: boolean; from?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (bp.rows.length > 0 || bp.baseOB !== 0));
  const isEmpty = bp.baseOB === 0 && bp.closingBalance === 0 && bp.rows.length === 0;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: open ? '#fff' : '#fafafa' }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', minWidth: 60 }}>{bp.bp.code}</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{bp.bp.name}</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{bp.rows.length} txn{bp.rows.length !== 1 ? 's' : ''}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: isEmpty ? '#94a3b8' : '#1e293b', minWidth: 110, textAlign: 'right' }}>
          {isEmpty ? 'Nil' : <BalanceCell value={bp.closingBalance} isDebitNormal={isDebitNormal} />}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <LedgerTable
            rows={bp.rows as LedgerResult['rows']}
            baseOB={bp.baseOB}
            openingBalance={bp.openingBalance}
            closingBalance={bp.closingBalance}
            isDebitNormal={isDebitNormal}
            from={from}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const ALL_ACCOUNTS = '__ALL__';

export default function LedgerPage() {
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const [mode, setMode] = useState<'ledger' | 'sub'>('ledger');
  const [applied, setApplied] = useState<{ accountId: string; from: string; to: string; mode: 'ledger' | 'sub' } | null>(null);

  const { data: accountsData } = useListAccountsQuery();
  const accounts = (accountsData?.data ?? []) as Account[];

  // Selected account object (for control account detection)
  const selectedAccount = accounts.find(a => a.id === accountId);
  const isControlAccount = selectedAccount?.is_control_account === true;

  const isAll = applied?.accountId === ALL_ACCOUNTS;
  const isSub = applied?.mode === 'sub';

  // Queries — each skips unless the right mode is active
  const { data: ledgerData, isLoading: loadingLedger, isFetching: fetchingLedger } = useGetLedgerQuery(
    { account_id: applied?.accountId ?? '', from: applied?.from, to: applied?.to },
    { skip: !applied || isAll || isSub },
  );
  const { data: allData, isLoading: loadingAll, isFetching: fetchingAll } = useGetAllLedgerQuery(
    { from: applied?.from, to: applied?.to },
    { skip: !applied || !isAll },
  );
  const { data: subData, isLoading: loadingSub, isFetching: fetchingSub } = useGetSubLedgerQuery(
    { account_id: applied?.accountId ?? '', from: applied?.from, to: applied?.to },
    { skip: !applied || !isSub },
  );

  const isLoading = loadingLedger || loadingAll || loadingSub || fetchingLedger || fetchingAll || fetchingSub;

  const handleView = () => {
    if (!accountId) return;
    setApplied({ accountId, from, to, mode: accountId === ALL_ACCOUNTS ? 'ledger' : mode });
  };

  const grouped = TYPE_ORDER.reduce((acc, t) => {
    acc[t] = accounts.filter(a => a.type === t && !a.is_group);
    return acc;
  }, {} as Record<string, Account[]>);

  const ledger   = ledgerData?.data;
  const allAccts = allData?.data ?? [];
  const subLedger = subData?.data;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Ledger' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1040 }}>

        {/* ── Filter bar ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Account selector */}
            <div style={{ flex: 2, minWidth: 240 }}>
              <label style={lbl}>Account</label>
              <select style={{ ...fc, width: '100%' }} value={accountId} onChange={e => { setAccountId(e.target.value); setMode('ledger'); }}>
                <option value="">— Select account —</option>
                <option value={ALL_ACCOUNTS}>📚 All Accounts (General Ledger)</option>
                {TYPE_ORDER.map(type => (
                  grouped[type].length > 0 && (
                    <optgroup key={type} label={`${TYPE_META[type].label}s`}>
                      {grouped[type].map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}{a.is_control_account ? ' ⊕' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label style={lbl}>From</label>
              <input type="date" style={fc} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>To</label>
              <input type="date" style={fc} value={to} onChange={e => setTo(e.target.value)} />
            </div>

            {/* Sub-ledger toggle (only for control accounts, not All) */}
            {isControlAccount && accountId !== ALL_ACCOUNTS && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={lbl}>View</label>
                <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    onClick={() => setMode('ledger')}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: mode === 'ledger' ? '#2563eb' : '#fff', color: mode === 'ledger' ? '#fff' : '#475569', border: 'none', cursor: 'pointer' }}
                  >Ledger</button>
                  <button
                    onClick={() => setMode('sub')}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: mode === 'sub' ? '#7c3aed' : '#fff', color: mode === 'sub' ? '#fff' : '#475569', border: 'none', cursor: 'pointer', borderLeft: '1px solid #e2e8f0' }}
                  >Sub-Ledger</button>
                </div>
              </div>
            )}

            <button
              onClick={handleView}
              disabled={!accountId}
              style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: accountId ? 'pointer' : 'not-allowed', opacity: accountId ? 1 : 0.5 }}
            >
              View Ledger
            </button>
            <button onClick={() => window.print()} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>
              <i className="ti ti-printer" style={{ fontSize: 14 }} /> Print
            </button>
          </div>

          {/* Control account badge */}
          {isControlAccount && accountId !== ALL_ACCOUNTS && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              ⊕ This is a control account — switch to <strong>Sub-Ledger</strong> view to see balances per business partner.
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Loading ledger…</div>
        )}

        {/* ── Empty state ── */}
        {!applied && !isLoading && (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            Select an account above and click View Ledger.<br />
            <span style={{ fontSize: 12 }}>Choose <em>All Accounts</em> for the full General Ledger, or select a ⊕ Control Account to view its Sub-Ledger.</span>
          </div>
        )}

        {/* ── Single account ledger ── */}
        {!isLoading && ledger && !isAll && !isSub && (
          <>
            {/* Account header */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{ledger.account.code}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{ledger.account.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: TYPE_META[ledger.account.type]?.bg, color: TYPE_META[ledger.account.type]?.color }}>
                    {TYPE_META[ledger.account.type]?.label}
                  </span>
                  {ledger.account.sub_type && <span style={{ fontSize: 11.5, color: '#64748b' }}>· {ledger.account.sub_type}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {applied?.from || applied?.to
                    ? `Period: ${applied!.from ? fmtDate(applied!.from) : 'beginning'} — ${applied!.to ? fmtDate(applied!.to) : 'today'}`
                    : 'All time'} · {ledger.rows.length} transaction{ledger.rows.length !== 1 ? 's' : ''}
                  {ledger.baseOB !== 0 && (
                    <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 99, background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600 }}>
                      b/f: <BalanceCell value={ledger.baseOB} isDebitNormal={ledger.isDebitNormal} />
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <LedgerTable
                rows={ledger.rows}
                baseOB={ledger.baseOB}
                openingBalance={ledger.openingBalance}
                closingBalance={ledger.closingBalance}
                isDebitNormal={ledger.isDebitNormal}
                from={applied?.from}
              />
            </div>
          </>
        )}

        {/* ── All accounts ── */}
        {!isLoading && isAll && allAccts.length > 0 && (
          <>
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>General Ledger — All Accounts</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {applied?.from || applied?.to
                    ? `Period: ${applied!.from ? fmtDate(applied!.from) : 'beginning'} — ${applied!.to ? fmtDate(applied!.to) : 'today'}`
                    : 'All time'} · {allAccts.length} accounts
                </div>
              </div>
            </div>

            {TYPE_ORDER.map(type => {
              const typeAccts = allAccts.filter(a => a.account.type === type);
              if (typeAccts.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TYPE_META[type].color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, padding: '4px 0', borderBottom: `2px solid ${TYPE_META[type].bg}` }}>
                    {TYPE_META[type].label}s
                  </div>
                  {typeAccts.map(a => (
                    <AccountBlock key={a.account.id} ledger={a} from={applied?.from} />
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ── Sub-ledger view ── */}
        {!isLoading && isSub && subLedger && (
          <>
            {/* Control account header */}
            <div style={{ background: '#fff', border: '1px solid #ddd6fe', borderLeft: '4px solid #7c3aed', borderRadius: 10, padding: '12px 18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{subLedger.account.code}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{subLedger.account.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: '#f5f3ff', color: '#7c3aed' }}>Control Account</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Sub-Ledger · {subLedger.bps.length} business partner{subLedger.bps.length !== 1 ? 's' : ''}
                    {(applied?.from || applied?.to) && ` · Period: ${applied!.from ? fmtDate(applied!.from) : 'beginning'} — ${applied!.to ? fmtDate(applied!.to) : 'today'}`}
                  </div>
                </div>
                {/* Summary totals */}
                <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Total Closing</div>
                    <div style={{ fontWeight: 700, color: '#7c3aed' }}>
                      <BalanceCell
                        value={subLedger.bps.reduce((s, bp) => s + bp.closingBalance, 0)}
                        isDebitNormal={subLedger.isDebitNormal}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {subLedger.bps.length === 0 ? (
              <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center', fontSize: 13, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                No business partners linked to this control account.
              </div>
            ) : (
              subLedger.bps.map(bp => (
                <BPBlock key={bp.bp.id} bp={bp} isDebitNormal={subLedger.isDebitNormal} from={applied?.from} />
              ))
            )}
          </>
        )}
      </div>

      <style>{`
        @media print {
          nav, aside, button, [class*="sidebar"], [class*="header"] { display: none !important; }
          body { background: white; }
          table { font-size: 10pt; }
        }
      `}</style>
    </Layout>
  );
}
