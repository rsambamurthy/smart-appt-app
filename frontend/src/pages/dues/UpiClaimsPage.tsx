import { useState, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListUpiClaimsQuery, useConfirmUpiClaimMutation, useRejectUpiClaimMutation,
  useGetUpiConfigQuery, useListUpiAccountsQuery,
  useSaveBankUpiMutation, useSelectUpiAccountMutation,
  type ClaimStatus,
} from '../../store/api/upiApi';

/**
 * Confirming UPI payments residents say they have made.
 *
 * This screen exists because the app cannot know whether money arrived. The
 * treasurer holds the only source of truth — the bank statement — so the job
 * here is to put the reference number, amount and date in front of them in a
 * form they can compare against it quickly, and to make confirming one claim a
 * single click.
 */

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const daysAgo = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const btn: CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontSize: 13, cursor: 'pointer', fontWeight: 600,
};

const th: CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', padding: '9px 12px', textAlign: 'left',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};

const td: CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#1e293b' };

const amountCell: CSSProperties = {
  fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap',
};

// ── UPI setup ─────────────────────────────────────────────────────────────────

/**
 * Which bank account collects UPI, and what residents see when paying into it.
 *
 * The UPI ID sits on the bank record rather than on the association, because a
 * VPA credits exactly one account. The payee name sits there too: plenty of
 * small associations bank in a treasurer's individual name, and a payee name
 * that does not match the account makes residents abandon the payment.
 */
function UpiSetup() {
  const { data: cfgData }  = useGetUpiConfigQuery();
  const { data: acctData } = useListUpiAccountsQuery();
  const [saveBank, { isLoading: savingBank, error: bankError }] = useSaveBankUpiMutation();
  const [selectAcct, { isLoading: selecting }] = useSelectUpiAccountMutation();

  const [open, setOpen]     = useState(false);
  const [editing, setEdit]  = useState<string | null>(null);
  const [vpa, setVpa]       = useState('');
  const [payee, setPayee]   = useState('');

  const cfg      = cfgData?.data;
  const accounts = acctData?.data ?? [];

  const msg = bankError && 'data' in bankError
    ? ((bankError.data as { message?: string })?.message ?? 'Could not save.')
    : null;

  if (!open) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12,
                    alignItems: 'center', flexWrap: 'wrap',
                    background: cfg?.enabled ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${cfg?.enabled ? '#bbf7d0' : '#fde68a'}`,
                    borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#1e293b' }}>
          {cfg?.enabled ? (
            <>
              Residents pay <strong>{cfg.payee_name}</strong> at{' '}
              <strong>{cfg.upi_vpa}</strong>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Credited to {cfg.bank_name}
                {cfg.account_hint ? ` ${cfg.account_hint}` : ''}
              </div>
            </>
          ) : (
            <>UPI collection is off. Residents cannot pay from the app until a
               bank account with a UPI ID is selected.</>
          )}
        </div>
        <button onClick={() => setOpen(true)} style={btn}>
          {cfg?.enabled ? 'Change' : 'Set up UPI'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff',
                  padding: 16, marginBottom: 16, maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>UPI collection account</div>
        <button onClick={() => { setOpen(false); setEdit(null); }} style={btn}>Done</button>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', margin: '6px 0 12px', lineHeight: 1.55 }}>
        Add the UPI ID to the bank account it actually credits, then select which
        one collects dues. Bank accounts come from Business Partners.
      </div>

      {msg && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', marginBottom: 10 }}>{msg}</div>
      )}

      {accounts.length === 0 ? (
        <div style={{ fontSize: 13, color: '#64748b', padding: '12px 0' }}>
          No bank accounts yet. Add one under Accounting → Business Partners → Banks,
          then come back here.
        </div>
      ) : accounts.map(a => (
        <div key={a.id} style={{
          border: `1px solid ${a.selected ? '#bbf7d0' : '#e2e8f0'}`,
          background: a.selected ? '#f0fdf4' : '#fff',
          borderRadius: 9, padding: '11px 13px', marginBottom: 8,
          opacity: a.is_active ? 1 : 0.55,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                {a.name}
                {!a.is_active && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: '#b45309' }}>inactive</span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                {a.account_number ? `••••${a.account_number.slice(-4)}` : a.code}
                {a.upi_vpa ? (
                  <> · <strong style={{ color: '#15803d' }}>{a.upi_vpa}</strong>
                     {a.upi_payee_name ? ` as ${a.upi_payee_name}` : ''}</>
                ) : (
                  <> · no UPI ID</>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {editing !== a.id && (
                <button
                  onClick={() => {
                    setEdit(a.id);
                    setVpa(a.upi_vpa ?? '');
                    setPayee(a.upi_payee_name ?? a.name);
                  }}
                  style={{ ...btn, fontSize: 12, padding: '4px 10px' }}>
                  {a.upi_vpa ? 'Edit UPI' : 'Add UPI'}
                </button>
              )}
              {a.upi_vpa && a.is_active && !a.selected && (
                <button
                  onClick={() => selectAcct({ bank_bp_id: a.id }).unwrap().catch(() => {})}
                  disabled={selecting}
                  style={{ ...btn, fontSize: 12, padding: '4px 10px',
                           background: '#15803d', color: '#fff', borderColor: '#15803d' }}>
                  Collect here
                </button>
              )}
              {a.selected && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803d',
                               alignSelf: 'center' }}>
                  Collecting
                </span>
              )}
            </div>
          </div>

          {editing === a.id && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>UPI ID</label>
              <input value={vpa} onChange={e => setVpa(e.target.value.trim())}
                placeholder="parkavenue@okhdfcbank"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 8,
                         border: '1px solid #cbd5e1', fontSize: 14,
                         margin: '4px 0 10px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                Payee name residents will see
              </label>
              <input value={payee} onChange={e => setPayee(e.target.value)}
                placeholder="e.g. R Sambamurthy, or Park Avenue Owners Association"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 8,
                         border: '1px solid #cbd5e1', fontSize: 14,
                         margin: '4px 0 6px', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>
                Use the name the bank account is actually held in. If it is a
                treasurer's personal account, put their name — residents abandon
                payments to a payee they do not recognise, and telling them in
                advance avoids the phone call.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() =>
                    saveBank({ bpId: a.id, upi_vpa: vpa || null, upi_payee_name: payee || null })
                      .unwrap().then(() => setEdit(null)).catch(() => {})}
                  disabled={savingBank}
                  style={{ ...btn, background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }}>
                  {savingBank ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEdit(null)} style={btn}>Cancel</button>
                {a.upi_vpa && (
                  <button
                    onClick={() =>
                      saveBank({ bpId: a.id, upi_vpa: null })
                        .unwrap().then(() => setEdit(null)).catch(() => {})}
                    style={{ ...btn, marginLeft: 'auto', color: '#b91c1c', borderColor: '#fca5a5' }}>
                    Remove UPI ID
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {cfg?.enabled && (
        <button
          onClick={() => selectAcct({ bank_bp_id: null }).unwrap().catch(() => {})}
          style={{ ...btn, marginTop: 4, color: '#b91c1c', borderColor: '#fca5a5' }}>
          Turn off UPI collection
        </button>
      )}
    </div>
  );
}

// ── Reject ────────────────────────────────────────────────────────────────────

function RejectBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [reject, { isLoading }] = useRejectUpiClaimMutation();

  return (
    <div style={{ background: '#fef2f2', borderRadius: 8, padding: 11, marginTop: 8 }}>
      <textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="e.g. No matching credit in the bank statement for this reference"
        style={{ width: '100%', minHeight: 54, padding: '8px 10px', borderRadius: 7,
                 border: '1px solid #cbd5e1', fontSize: 13, resize: 'vertical',
                 boxSizing: 'border-box' }} />
      <div style={{ fontSize: 11.5, color: '#92400e', margin: '6px 0 8px' }}>
        The resident sees this, so tell them what to do next.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => reject({ id, note }).unwrap().then(onDone).catch(() => {})}
          disabled={isLoading || note.trim().length < 5}
          style={{ ...btn, background: '#b91c1c', color: '#fff', borderColor: '#b91c1c',
                   opacity: note.trim().length < 5 ? 0.5 : 1 }}>
          {isLoading ? 'Rejecting…' : 'Reject'}
        </button>
        <button onClick={onDone} style={btn}>Cancel</button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UpiClaimsPage() {
  const [status, setStatus]   = useState<ClaimStatus>('PENDING');
  const [rejecting, setRej]   = useState<string | null>(null);

  const { data, isLoading } = useListUpiClaimsQuery({ status });
  const [confirm, { isLoading: confirming }] = useConfirmUpiClaimMutation();

  const rows = data?.data ?? [];

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Dues' }, { label: 'UPI Payments' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 1080 }}>

        <UpiSetup />

        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['PENDING', 'CONFIRMED', 'REJECTED'] as ClaimStatus[]).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '6px 13px', borderRadius: 99, border: 'none',
                       cursor: 'pointer', fontSize: 13,
                       fontWeight: s === status ? 700 : 500,
                       background: s === status ? '#1e293b' : '#f1f5f9',
                       color: s === status ? '#fff' : '#64748b' }}>
              {s === 'PENDING' ? 'To confirm' : s === 'CONFIRMED' ? 'Confirmed' : 'Rejected'}
              {s === 'PENDING' && data?.totals.count ? ` (${data.totals.count})` : ''}
            </button>
          ))}
        </div>

        {status === 'PENDING' && data && data.totals.count > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a',
                        borderRadius: 10, padding: '11px 14px', marginBottom: 14,
                        fontSize: 13, color: '#92400e' }}>
            <strong>₹{money(data.totals.amount)}</strong> across {data.totals.count}{' '}
            {data.totals.count === 1 ? 'payment' : 'payments'} waiting.
            Check each reference against the association's bank statement before confirming —
            confirming records the money as received and posts it to the accounts.
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '2rem 1rem', color: '#64748b', fontSize: 13.5 }}>
            {status === 'PENDING'
              ? 'Nothing waiting. Residents who pay by UPI from the app will appear here.'
              : 'Nothing here yet.'}
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12,
                        background: '#fff', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={th}>Flat</th>
                    <th style={th}>Period</th>
                    <th style={th}>UPI reference</th>
                    <th style={th}>Paid on</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                    {status === 'PENDING' && <th style={{ ...th, textAlign: 'right' }}>Waiting</th>}
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const waited = daysAgo(r.claimed_at);
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid #f8fafc' }}>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {r.flat_number}{r.block ? ` · ${r.block}` : ''}
                          <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 400 }}>
                            {r.resident}
                          </div>
                        </td>
                        <td style={td}>{r.period}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 12.5 }}>
                          {r.upi_reference}
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748b' }}>
                          {fmtDate(r.paid_on)}
                        </td>
                        <td style={{ ...td, ...amountCell, fontWeight: 700 }}>
                          {money(r.amount)}
                          {Math.abs(r.amount - r.bill_total) > 0.005 && (
                            <div style={{ fontSize: 11, color: '#b45309', fontWeight: 400 }}>
                              bill ₹{money(r.bill_total)}
                            </div>
                          )}
                        </td>
                        {status === 'PENDING' && (
                          <td style={{ ...td, ...amountCell,
                                       color: waited > 3 ? '#b91c1c' : '#64748b',
                                       fontWeight: waited > 3 ? 700 : 400 }}>
                            {waited === 0 ? 'today' : `${waited}d`}
                          </td>
                        )}
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {status === 'PENDING' ? (
                            rejecting === r.id ? null : (
                              <>
                                <button
                                  onClick={() => confirm(r.id).unwrap().catch(() => {})}
                                  disabled={confirming}
                                  style={{ ...btn, background: '#15803d', color: '#fff',
                                           borderColor: '#15803d', marginRight: 6 }}>
                                  Confirm
                                </button>
                                <button onClick={() => setRej(r.id)} style={btn}>Reject</button>
                              </>
                            )
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>
                              {r.reviewed_by ?? '—'}
                            </span>
                          )}
                          {rejecting === r.id && (
                            <RejectBox id={r.id} onDone={() => setRej(null)} />
                          )}
                          {r.review_note && status === 'REJECTED' && (
                            <div style={{ fontSize: 11.5, color: '#b91c1c', textAlign: 'left',
                                          marginTop: 4, maxWidth: 240 }}>
                              {r.review_note}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14,
                      lineHeight: 1.65, maxWidth: 700 }}>
          A resident tapping "Pay by UPI" opens their own payment app; SmartAppt never
          sees whether the transfer succeeded, so nothing is recorded until you confirm
          it here. Confirming creates the payment and posts it to the ledger — an amber
          note under the amount means it differs from the bill total, which usually means
          a part payment or a typo.
        </div>
      </div>
    </Layout>
  );
}
