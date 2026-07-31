import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListFYsQuery,
  useGetFYConfigQuery,
  useUpdateFYConfigMutation,
  usePreviewFYClosureQuery,
  useCloseFYMutation,
  useReopenFYMutation,
  type FYStatus,
  type FYPreviewResult,
} from '../../store/api/accountingApi';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const fc: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4,
};

const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── FY Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    OPEN:     { bg: '#f0fdf4', color: '#16a34a', label: 'Open' },
    CLOSED:   { bg: '#fef2f2', color: '#dc2626', label: 'Closed' },
    REOPENED: { bg: '#fffbeb', color: '#d97706', label: 'Reopened' },
  };
  const s = map[status] ?? map['OPEN'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Closure Preview Panel ────────────────────────────────────────────────────
function ClosurePanel({
  fy,
  onClose,
}: {
  fy: string;
  onClose: () => void;
}) {
  const { data: previewData, isLoading, error } = usePreviewFYClosureQuery({ fy });
  const [closeFY, { isLoading: closing }] = useCloseFYMutation();
  const [surplusAccountId, setSurplusAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const preview: FYPreviewResult | null = previewData?.data ?? null;

  const handleClose = async () => {
    if (!surplusAccountId) { setMsg({ type: 'err', text: 'Select the surplus/deficit account.' }); return; }
    setMsg(null);
    try {
      const res = await closeFY({ fy, surplus_account_id: surplusAccountId, notes }).unwrap();
      setMsg({ type: 'ok', text: `FY ${res.data.financial_year} closed. Net ${res.data.net_surplus >= 0 ? 'Surplus' : 'Deficit'}: ${fmtAmt(res.data.net_surplus)}.` });
      setConfirm(false);
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.data?.message ?? 'Closure failed.' });
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', flex: 1 }}>Year Closure — FY {fy}</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>✕</button>
      </div>

      {isLoading && <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading preview…</div>}
      {error && <div style={{ padding: '1rem 20px', color: '#dc2626', fontSize: 13 }}>⚠ {(error as any)?.data?.message ?? 'Could not load preview.'}</div>}

      {preview && (
        <div style={{ padding: '20px' }}>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Income', value: preview.total_income, color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Total Expense', value: preview.total_expense, color: '#dc2626', bg: '#fef2f2' },
              { label: preview.net_surplus >= 0 ? 'Net Surplus' : 'Net Deficit', value: preview.net_surplus, color: preview.net_surplus >= 0 ? '#7c3aed' : '#dc2626', bg: preview.net_surplus >= 0 ? '#f5f3ff' : '#fef2f2' },
            ].map(card => (
              <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: card.color, textTransform: 'uppercase', marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{fmtAmt(Math.abs(card.value))}</div>
              </div>
            ))}
          </div>

          {/* Income & Expense breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Income */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>INCOME ACCOUNTS — will be closed (Dr)</div>
              {preview.income_lines.length === 0
                ? <div style={{ padding: '1rem', color: '#94a3b8', fontSize: 12 }}>No income transactions.</div>
                : preview.income_lines.map(l => (
                    <div key={l.account.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
                      <span style={{ color: '#475569' }}>{l.account.code} — {l.account.name}</span>
                      <span style={{ fontWeight: 600, color: '#16a34a' }}>{fmtAmt(l.balance)}</span>
                    </div>
                  ))
              }
            </div>
            {/* Expense */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>EXPENSE ACCOUNTS — will be closed (Cr)</div>
              {preview.expense_lines.length === 0
                ? <div style={{ padding: '1rem', color: '#94a3b8', fontSize: 12 }}>No expense transactions.</div>
                : preview.expense_lines.map(l => (
                    <div key={l.account.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
                      <span style={{ color: '#475569' }}>{l.account.code} — {l.account.name}</span>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmtAmt(l.balance)}</span>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* Surplus account selector */}
          <div style={{ marginBottom: 16, maxWidth: 400 }}>
            <label style={lbl}>Transfer Net {preview.net_surplus >= 0 ? 'Surplus' : 'Deficit'} To (Equity Account)</label>
            <select style={{ ...fc, width: '100%' }} value={surplusAccountId} onChange={e => setSurplusAccountId(e.target.value)}>
              <option value="">— Select equity account —</option>
              {preview.equity_accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20, maxWidth: 400 }}>
            <label style={lbl}>Notes (optional)</label>
            <input style={{ ...fc, width: '100%' }} type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Approved in AGM on 01-Apr-2026" />
          </div>

          {msg && (
            <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 7, background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, color: msg.type === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 500 }}>
              {msg.text}
            </div>
          )}

          {/* Warning + confirm */}
          {!msg?.type || msg.type === 'err' ? (
            !confirm ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirm(true)}
                  disabled={!surplusAccountId}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: surplusAccountId ? '#dc2626' : '#e2e8f0', color: surplusAccountId ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: surplusAccountId ? 'pointer' : 'not-allowed' }}
                >
                  🔒 Close FY {fy}
                </button>
                <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8, fontSize: 13 }}>⚠ This action will post a closing journal entry and lock FY {fy}.</div>
                <div style={{ fontSize: 12.5, color: '#78350f', marginBottom: 14 }}>
                  All Income &amp; Expense account balances will be zeroed out. Net {preview.net_surplus >= 0 ? 'Surplus' : 'Deficit'} of <strong>{fmtAmt(Math.abs(preview.net_surplus))}</strong> will be transferred to the selected equity account.
                  New journal entries cannot be posted to FY {fy} after closure.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleClose} disabled={closing} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: closing ? 'wait' : 'pointer' }}>
                    {closing ? 'Closing…' : 'Confirm & Close Year'}
                  </button>
                  <button onClick={() => setConfirm(false)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>
                    Go Back
                  </button>
                </div>
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function FYClosurePage() {
  const { data: fyList, isLoading: loadingList, refetch } = useListFYsQuery();
  const { data: configData } = useGetFYConfigQuery();
  const [updateConfig, { isLoading: savingConfig }] = useUpdateFYConfigMutation();
  const [reopenFY, { isLoading: reopening }]         = useReopenFYMutation();

  const [startMonth, setStartMonth] = useState<number | null>(null);
  const [configMsg, setConfigMsg]   = useState('');
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [actionMsg, setActionMsg]   = useState<{ fy: string; type: 'ok' | 'err'; text: string } | null>(null);

  const currentMonth = configData?.data?.financial_year_start_month ?? fyList?.fy_start_month ?? 4;
  const effectiveMonth = startMonth ?? currentMonth;

  const handleSaveConfig = async () => {
    setConfigMsg('');
    try {
      await updateConfig({ financial_year_start_month: effectiveMonth }).unwrap();
      setConfigMsg('✓ Financial year start month saved.');
      setStartMonth(null);
      refetch();
    } catch { setConfigMsg('✗ Failed to save.'); }
  };

  const handleReopen = async (fy: string) => {
    setActionMsg(null);
    try {
      await reopenFY({ fy }).unwrap();
      setActionMsg({ fy, type: 'ok', text: `FY ${fy} reopened successfully.` });
      refetch();
    } catch (e: any) {
      setActionMsg({ fy, type: 'err', text: e?.data?.message ?? 'Reopen failed.' });
    }
  };

  const fys = fyList?.data ?? [];

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Financial Year & Closure' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 900 }}>

        {/* ── FY Configuration ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Financial Year Configuration</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 18 }}>
            Set the month your financial year begins. The year is automatically named e.g. "2025-26" (April 2025 → March 2026).
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>FY Start Month</label>
              <select style={{ ...fc, minWidth: 160 }} value={effectiveMonth} onChange={e => setStartMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m} (Month {i + 1})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Preview</label>
              <div style={{ padding: '7px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#475569', minWidth: 120 }}>
                {(() => {
                  const now = new Date();
                  const m = now.getMonth() + 1;
                  const y = now.getFullYear();
                  const sy = m >= effectiveMonth ? y : y - 1;
                  return `${sy}-${String(sy + 1).slice(-2)}`;
                })()}
              </div>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig || effectiveMonth === currentMonth}
              style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: effectiveMonth !== currentMonth ? '#2563eb' : '#e2e8f0', color: effectiveMonth !== currentMonth ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: effectiveMonth !== currentMonth ? 'pointer' : 'not-allowed' }}
            >
              {savingConfig ? 'Saving…' : 'Save'}
            </button>
          </div>

          {configMsg && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: configMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{configMsg}</div>
          )}
        </div>

        {/* ── FY List ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', flex: 1 }}>Financial Years</span>
          </div>

          {loadingList ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
          ) : fys.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No journal entries found. Start posting to create financial years.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Financial Year</th>
                  <th style={{ padding: '9px 16px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Net Surplus / Deficit</th>
                  <th style={{ padding: '9px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Closed By / At</th>
                  <th style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...fys].reverse().map((fy: FYStatus) => (
                  <tr key={fy.financial_year} style={{ borderTop: '1px solid #f1f5f9', background: fy.is_current ? '#fffbeb' : '#fff' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{fy.financial_year}</span>
                      {fy.is_current && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, background: '#fde68a', color: '#92400e', padding: '1px 7px', borderRadius: 99 }}>Current</span>}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <StatusBadge status={fy.status} />
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600 }}>
                      {fy.net_surplus !== null
                        ? <span style={{ color: fy.net_surplus >= 0 ? '#7c3aed' : '#dc2626' }}>
                            {fmtAmt(Math.abs(fy.net_surplus))} {fy.net_surplus >= 0 ? 'Surplus' : 'Deficit'}
                          </span>
                        : <span style={{ color: '#94a3b8' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '11px 16px', color: '#64748b', fontSize: 12 }}>
                      {fy.closed_by ? <><strong>{fy.closed_by}</strong><br />{fmtDate(fy.closed_at)}</> : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      {fy.status !== 'CLOSED' ? (
                        <button
                          onClick={() => setActivePanel(activePanel === fy.financial_year ? null : fy.financial_year)}
                          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          🔒 Close Year
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReopen(fy.financial_year)}
                          disabled={reopening}
                          style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer' }}
                        >
                          🔓 Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Action messages ── */}
        {actionMsg && (
          <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, background: actionMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${actionMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, color: actionMsg.type === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13 }}>
            {actionMsg.text}
          </div>
        )}

        {/* ── Inline closure panel ── */}
        {activePanel && (
          <ClosurePanel
            fy={activePanel}
            onClose={() => { setActivePanel(null); refetch(); }}
          />
        )}
      </div>
    </Layout>
  );
}
