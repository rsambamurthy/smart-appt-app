import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListJournalEntriesQuery, useCreateJournalEntryMutation,
  useUpdateJournalEntryMutation,
  useListAccountsQuery,
  useListBPMastersQuery,
  useListBPTypesQuery,
  BPCategory,
  JournalEntry,
} from '../../store/api/accountingApi';

// ── Infer BPCategory from BPType name ─────────────────────────────────────────
function inferCategoryFromTypeName(name: string): BPCategory | null {
  const n = name.toLowerCase();
  if (n.includes('unit') || n.includes('flat') || n.includes('resident')) return 'UNIT';
  if (n.includes('bank'))                                                  return 'BANK';
  if (n.includes('vendor') || n.includes('supplier'))                     return 'VENDOR';
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const TODAY = new Date().toISOString().slice(0, 10);

const TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  AUTO:   { bg: '#eff6ff', color: '#2563eb', label: 'Auto' },
  MANUAL: { bg: '#f5f3ff', color: '#7c3aed', label: 'Manual' },
};

const REF_LABELS: Record<string, string> = {
  DUES_BILL:       'Dues Bill',
  PAYMENT:         'Payment',
  EXPENSE:         'Expense',
  OTHER_RECEIPT:   'Other Receipt',
  OPENING_BALANCE: 'Opening Balance',
  MANUAL:          'Manual',
};

// ── Line state — voucher style: one Amount + DR/CR direction ─────────────────
type LineState = {
  _key:                number;
  account_id:          string;
  business_partner_id: string;
  amount:              number;
  drCr:                'DR' | 'CR';
  narration:           string;
};

const emptyLine = (): LineState => ({
  _key:                Date.now() + Math.random(),
  account_id:          '',
  business_partner_id: '',
  amount:              0,
  drCr:                'DR',
  narration:           '',
});

// ── Voucher classes ───────────────────────────────────────────────────────────
// The three things a treasurer actually records. Bank and Cash vouchers have a
// direction and a single money account; the other side is what they enter.
type VoucherClass = 'BANK' | 'CASH' | 'JOURNAL';
type Direction    = 'RECEIPT' | 'PAYMENT';

const VOUCHER_CLASS_LABEL: Record<VoucherClass, string> = {
  BANK:    'Bank',
  CASH:    'Cash',
  JOURNAL: 'Journal',
};

// Must mirror getCashBankAccounts() on the server: classify by code, never by
// name, so renaming "Bank Account" to "HDFC Current A/c" changes nothing.
type ClassifiableAccount = { id: string; code: string; sub_type?: string | null };

const isCashAccount = (a: ClassifiableAccount) =>
  a.code === '1001' || a.sub_type?.toLowerCase() === 'cash';

const isBankAccount = (a: ClassifiableAccount) =>
  a.code === '1002' || a.sub_type?.toLowerCase() === 'bank';

// ── Shared styles ─────────────────────────────────────────────────────────────
const cellInp: React.CSSProperties = {
  border: 'none', outline: 'none', width: '100%',
  padding: '0 8px', fontSize: 12.5, color: '#1e293b',
  background: 'transparent', boxSizing: 'border-box', height: '100%',
};
const cellSel: React.CSSProperties = {
  ...cellInp, cursor: 'pointer',
};
const thSt: React.CSSProperties = {
  padding: '7px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600,
  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em',
};

// Voucher grid border
const vBord = '1px solid #d1d5db';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function JournalEntriesPage() {

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filter, setFilter] = useState({ type: '', from: '', to: '' });

  // ── Panel state ───────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode,   setFormMode]   = useState<'new' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<JournalEntry | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [entryDate, setEntryDate] = useState(TODAY);
  const [narration, setNarration] = useState('');
  const [lines,     setLines]     = useState<LineState[]>([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState('');

  // Voucher class drives the whole form: Bank and Cash collect a direction and
  // one money account, and the contra lines are all the treasurer fills in.
  const [voucherClass, setVoucherClass] = useState<VoucherClass>('BANK');
  const [direction,    setDirection]    = useState<Direction>('RECEIPT');
  const [moneyAccount, setMoneyAccount] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useListJournalEntriesQuery({
    type: filter.type || undefined,
    from: filter.from || undefined,
    to:   filter.to   || undefined,
  });
  const { data: accountsData } = useListAccountsQuery();
  const { data: bpData }       = useListBPMastersQuery({});
  const { data: bpTypesData }  = useListBPTypesQuery();
  const [createEntry, { isLoading: isCreating }] = useCreateJournalEntryMutation();
  const [updateEntry, { isLoading: isUpdating }] = useUpdateJournalEntryMutation();
  const isSaving = isCreating || isUpdating;

  const entries  = data?.data ?? [];
  const accounts = accountsData?.data ?? [];
  const allBPs   = bpData?.data ?? [];
  const bpTypes  = bpTypesData?.data ?? [];

  const accountMap       = new Map(accounts.map(a => [a.id, a]));

  // Money accounts available for each class, and the accounts a contra line
  // may use (never a cash or bank account — that side is generated).
  const cashAccounts  = accounts.filter(isCashAccount);
  const bankAccounts  = accounts.filter(isBankAccount);
  const moneyOptions  = voucherClass === 'BANK' ? bankAccounts
                      : voucherClass === 'CASH' ? cashAccounts
                      : [];
  const contraOptions = accounts.filter(a => !isCashAccount(a) && !isBankAccount(a));
  const isMoneyVoucher = voucherClass === 'BANK' || voucherClass === 'CASH';
  const bpTypeToCategory = new Map(bpTypes.map(t => [t.id, inferCategoryFromTypeName(t.name)]));
  const selectedEntry    = entries.find(e => e.id === selectedId) ?? null;

  // ── Form actions ──────────────────────────────────────────────────────────
  const openNewForm = () => {
    setSelectedId(null);
    setEditTarget(null);
    setEntryDate(TODAY);
    setNarration('');
    setVoucherClass('BANK');
    setDirection('RECEIPT');
    setMoneyAccount('');
    // Money vouchers start with a single contra line; the money side is added
    // on save. A journal voucher needs the usual two-line grid.
    setLines([emptyLine()]);
    setFormError('');
    setFormMode('new');
  };

  // Switching class resets the parts that no longer apply.
  const changeVoucherClass = (cls: VoucherClass) => {
    setVoucherClass(cls);
    setMoneyAccount('');
    setFormError('');
    setLines(cls === 'JOURNAL' ? [emptyLine(), emptyLine()] : [emptyLine()]);
  };

  const openEditForm = (entry: JournalEntry) => {
    setSelectedId(entry.id);
    setEditTarget(entry);
    setEntryDate(entry.entry_date.slice(0, 10));
    setNarration(entry.narration);

    const mapped = entry.lines.map(l => ({
      _key:                Math.random(),
      account_id:          l.account_id,
      business_partner_id: l.business_partner_id ?? '',
      amount:              Number(l.debit) > 0 ? Number(l.debit) : Number(l.credit),
      drCr:                Number(l.debit) > 0 ? 'DR' as const : 'CR' as const,
      narration:           l.narration ?? '',
    }));

    // Reconstruct which class this entry was, from the accounts it uses.
    const moneyLine = mapped.find(l => {
      const a = accountMap.get(l.account_id);
      return a ? (isCashAccount(a) || isBankAccount(a)) : false;
    });
    const moneyAcct = moneyLine ? accountMap.get(moneyLine.account_id) : undefined;

    if (moneyAcct && isBankAccount(moneyAcct)) setVoucherClass('BANK');
    else if (moneyAcct && isCashAccount(moneyAcct)) setVoucherClass('CASH');
    else setVoucherClass('JOURNAL');

    if (moneyLine) {
      setMoneyAccount(moneyLine.account_id);
      setDirection(moneyLine.drCr === 'DR' ? 'RECEIPT' : 'PAYMENT');
      setLines(mapped.filter(l => l !== moneyLine));
    } else {
      setMoneyAccount('');
      setLines(mapped);
    }

    setFormError('');
    setFormMode('edit');
  };

  const closeForm = () => { setFormMode(null); setEditTarget(null); };

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines(ls => ls.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === 'account_id') updated.business_partner_id = '';
      return updated;
    }));
  };

  const addLine    = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (idx: number) => setLines(ls => ls.filter((_, i) => i !== idx));

  // ── Balance ───────────────────────────────────────────────────────────────
  // On a money voucher the contra lines all sit on one side and the generated
  // money line balances them, so the total is simply their sum. A journal
  // voucher balances itself the usual way.
  const contraTotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const totalDebit  = isMoneyVoucher ? contraTotal
    : lines.filter(l => l.drCr === 'DR').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const totalCredit = isMoneyVoucher ? contraTotal
    : lines.filter(l => l.drCr === 'CR').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.005;

  const handleSave = async () => {
    setFormError('');
    if (!narration.trim()) { setFormError('Narration is required.'); return; }
    if (lines.some(l => !l.account_id)) { setFormError('All lines must have an account.'); return; }
    if (isMoneyVoucher && !moneyAccount) {
      setFormError(`Select the ${voucherClass === 'BANK' ? 'bank' : 'cash'} account.`);
      return;
    }

    for (const line of lines) {
      const acct = accountMap.get(line.account_id);
      if (acct?.is_control_account && !line.business_partner_id) {
        setFormError(`"${acct.name}" is a control account — select a Sub Account (Business Partner).`);
        return;
      }
    }
    if (!balanced) {
      setFormError(`Unbalanced: DR ₹${totalDebit.toFixed(2)} ≠ CR ₹${totalCredit.toFixed(2)}`);
      return;
    }
    if (totalDebit === 0) { setFormError('Entry amount cannot be zero.'); return; }

    // Contra lines. On a receipt money comes in, so the other side is credited;
    // on a payment it is debited.
    const contraDrCr: 'DR' | 'CR' = direction === 'RECEIPT' ? 'CR' : 'DR';

    const apiLines = lines.map(({ account_id, business_partner_id, amount, drCr, narration: ln }) => {
      const side = isMoneyVoucher ? contraDrCr : drCr;
      return {
        account_id,
        business_partner_id: business_partner_id || null,
        debit:     side === 'DR' ? (Number(amount) || 0) : 0,
        credit:    side === 'CR' ? (Number(amount) || 0) : 0,
        narration: ln || undefined,
      };
    });

    // The money line, generated rather than typed: one line, total amount,
    // opposite side to the contras.
    if (isMoneyVoucher) {
      apiLines.push({
        account_id:          moneyAccount,
        business_partner_id: null,
        debit:     direction === 'RECEIPT' ? contraTotal : 0,
        credit:    direction === 'PAYMENT' ? contraTotal : 0,
        narration: undefined,
      });
    }

    const payload = {
      entry_date:   entryDate,
      narration,
      voucher_type: voucherClass === 'BANK' ? 'BV' as const
                  : voucherClass === 'CASH' ? 'CV' as const
                  : 'JV' as const,
      lines: apiLines,
    };

    try {
      let result: { data: JournalEntry };
      if (editTarget) {
        result = await updateEntry({ id: editTarget.id, ...payload }).unwrap();
      } else {
        result = await createEntry(payload).unwrap();
      }
      setSelectedId(result.data.id);
      closeForm();
      refetch();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; title?: string; message?: string } };
      setFormError(err?.data?.detail ?? err?.data?.message ?? err?.data?.title ?? 'Failed to save entry.');
    }
  };

  // ── Group entries by date ─────────────────────────────────────────────────
  const grouped = entries.reduce((acc, e) => {
    const d = e.entry_date.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {} as Record<string, JournalEntry[]>);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // ── Right panel: voucher entry form ──────────────────────────────────────
  const renderForm = () => (
    <div style={{ padding: '18px 24px' }}>

      {/* Voucher title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {isMoneyVoucher
            ? `${VOUCHER_CLASS_LABEL[voucherClass]} ${direction === 'RECEIPT' ? 'Receipt' : 'Payment'}`
            : 'Journal Voucher'}
        </div>
        <button onClick={closeForm} title="Cancel"
          style={{ background: 'none', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>
          ×
        </button>
      </div>

      {/* ── Voucher class + direction ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', border: vBord, borderRadius: 7, overflow: 'hidden' }}>
          {(['BANK', 'CASH', 'JOURNAL'] as VoucherClass[]).map(cls => (
            <button key={cls} type="button" onClick={() => changeVoucherClass(cls)}
              style={{
                padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 12.5,
                fontWeight: voucherClass === cls ? 700 : 500,
                background: voucherClass === cls ? '#2563eb' : '#fff',
                color:      voucherClass === cls ? '#fff'    : '#475569',
              }}>
              {VOUCHER_CLASS_LABEL[cls]}
            </button>
          ))}
        </div>

        {isMoneyVoucher && (
          <div style={{ display: 'flex', border: vBord, borderRadius: 7, overflow: 'hidden' }}>
            {(['RECEIPT', 'PAYMENT'] as Direction[]).map(d => (
              <button key={d} type="button" onClick={() => { setDirection(d); setFormError(''); }}
                style={{
                  padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 12.5,
                  fontWeight: direction === d ? 700 : 500,
                  background: direction === d ? (d === 'RECEIPT' ? '#15803d' : '#dc2626') : '#fff',
                  color:      direction === d ? '#fff' : '#475569',
                }}>
                {d === 'RECEIPT' ? 'Receipt' : 'Payment'}
              </button>
            ))}
          </div>
        )}

        {isMoneyVoucher && (
          <select
            value={moneyAccount}
            onChange={e => { setMoneyAccount(e.target.value); setFormError(''); }}
            style={{ padding: '7px 10px', border: vBord, borderRadius: 7, fontSize: 12.5, color: '#1e293b', background: '#fff', minWidth: 200 }}
          >
            <option value="">
              {voucherClass === 'BANK' ? 'Select bank account…' : 'Select cash account…'}
            </option>
            {moneyOptions.map(a => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* What the entry will do, in words */}
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        {isMoneyVoucher ? (
          moneyOptions.length === 0 ? (
            <span style={{ color: '#b91c1c' }}>
              No {voucherClass === 'BANK' ? 'bank' : 'cash'} account found.
              {voucherClass === 'BANK'
                ? ' Add one with code 1002, or set an account’s sub-type to "Bank".'
                : ' Add one with code 1001, or set an account’s sub-type to "Cash".'}
            </span>
          ) : direction === 'RECEIPT'
            ? 'Money received. Enter what it was received for — the bank or cash side is added automatically.'
            : 'Money paid out. Enter what it was paid for — the bank or cash side is added automatically.'
        ) : (
          'For entries that do not involve cash or bank. To move money between cash and bank, make every line a cash or bank account.'
        )}
      </div>

      {/* ── Header row: Date | Narration | JV Number ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            {/* Date */}
            <td style={{ border: vBord, padding: '6px 10px', width: 60, fontSize: 11, fontWeight: 600, color: '#475569', background: '#f8fafc', whiteSpace: 'nowrap' }}>
              Date
            </td>
            <td style={{ border: vBord, padding: 0, width: 140 }}>
              <input type="date" style={{ ...cellInp, padding: '7px 10px' }}
                value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </td>

            {/* Narration */}
            <td style={{ border: vBord, padding: '6px 10px', width: 80, fontSize: 11, fontWeight: 600, color: '#475569', background: '#f8fafc', whiteSpace: 'nowrap' }}>
              Narration
            </td>
            <td style={{ border: vBord, padding: 0 }}>
              <input style={{ ...cellInp, padding: '7px 10px' }}
                value={narration} onChange={e => setNarration(e.target.value)}
                placeholder="Description of this entry…" />
            </td>

            {/* JV Number */}
            <td style={{ border: vBord, padding: '6px 10px', width: 85, fontSize: 11, fontWeight: 600, color: '#475569', background: '#f8fafc', whiteSpace: 'nowrap' }}>
              JV Number
            </td>
            <td style={{ border: vBord, padding: '6px 12px', width: 150, fontSize: 12, fontFamily: 'monospace', color: '#7c3aed', fontWeight: 700, background: '#faf5ff' }}>
              {editTarget?.reference_code ?? <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontFamily: 'sans-serif', fontWeight: 400, fontSize: 11.5 }}>Auto-generated</span>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Lines grid ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: -1 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: vBord, padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#475569' }}>
              Account
            </th>
            <th style={{ border: vBord, padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#475569', width: '32%' }}>
              Sub Account
            </th>
            <th style={{ border: vBord, padding: '7px 10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#475569', width: 130 }}>
              Amount
            </th>
            {/* Direction is fixed by Receipt/Payment on a money voucher. */}
            {!isMoneyVoucher && (
              <th style={{ border: vBord, padding: '7px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#475569', width: 72 }}>
                DR / CR
              </th>
            )}
            <th style={{ border: vBord, width: 28, background: '#f8fafc' }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const acct         = accountMap.get(line.account_id);
            const isCtrl       = acct?.is_control_account ?? false;
            const bpTypeId     = acct?.bp_type_id ?? null;
            const inferredCat  = bpTypeId ? (bpTypeToCategory.get(bpTypeId) ?? null) : null;
            const availableBPs = isCtrl
              ? allBPs.filter(bp => bp.is_active && (inferredCat ? bp.bp_category === inferredCat : true))
              : [];
            const bpMissing    = isCtrl && !line.business_partner_id;

            return (
              <tr key={line._key} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>

                {/* Account */}
                <td style={{ border: vBord, padding: 0, height: 36 }}>
                  <select style={cellSel} value={line.account_id}
                    onChange={e => updateLine(idx, 'account_id', e.target.value)}>
                    <option value="">— select —</option>
                    {/* On a money voucher the cash/bank side is generated, so
                        those accounts are not offered here. */}
                    {['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'].map(type => (
                      <optgroup key={type} label={type}>
                        {(isMoneyVoucher ? contraOptions : accounts)
                          .filter(a => a.type === type && a.is_active).map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}{a.is_control_account ? ' ⊕' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>

                {/* Sub Account (BP) — always visible, enabled only for control accounts */}
                <td style={{ border: vBord, padding: 0, height: 36, background: isCtrl ? (bpMissing ? '#fef9f0' : '#fff7ed') : '#fafafa' }}>
                  {isCtrl ? (
                    <select style={{ ...cellSel, color: bpMissing ? '#f97316' : '#1e293b' }}
                      value={line.business_partner_id}
                      onChange={e => updateLine(idx, 'business_partner_id', e.target.value)}>
                      <option value="">{bpMissing ? '⚠ required' : '— select —'}</option>
                      {availableBPs.map(bp => (
                        <option key={bp.id} value={bp.id}>{bp.code} — {bp.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ padding: '0 8px', fontSize: 12, color: '#cbd5e1' }}>—</span>
                  )}
                </td>

                {/* Amount */}
                <td style={{ border: vBord, padding: 0, height: 36 }}>
                  <input type="number" min="0" step="0.01"
                    style={{ ...cellInp, textAlign: 'right', fontWeight: line.amount > 0 ? 500 : 400 }}
                    value={line.amount || ''}
                    onChange={e => updateLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00" />
                </td>

                {/* DR / CR dropdown */}
                {!isMoneyVoucher && (
                  <td style={{ border: vBord, padding: 0, height: 36 }}>
                    <select
                      value={line.drCr}
                      onChange={e => updateLine(idx, 'drCr', e.target.value)}
                      style={{
                        ...cellSel,
                        fontWeight: 700, fontSize: 12.5, textAlign: 'center',
                        color: line.drCr === 'DR' ? '#1d4ed8' : '#15803d',
                        background: line.drCr === 'DR' ? '#eff6ff' : '#f0fdf4',
                      }}>
                      <option value="DR">DR</option>
                      <option value="CR">CR</option>
                    </select>
                  </td>
                )}

                {/* Remove */}
                <td style={{ border: vBord, padding: '4px 4px', textAlign: 'center' }}>
                  {lines.length > (isMoneyVoucher ? 1 : 2) && (
                    <button onClick={() => removeLine(idx)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {/* The generated money line, shown read-only so the treasurer can
              see the full double entry rather than half of it. */}
          {isMoneyVoucher && moneyAccount && (
            <tr style={{ background: direction === 'RECEIPT' ? '#f0fdf4' : '#fef2f2' }}>
              <td style={{ border: vBord, padding: '8px 10px', fontSize: 12.5, color: '#475569' }}>
                {(() => {
                  const a = accountMap.get(moneyAccount);
                  return a ? `${a.code} — ${a.name}` : '';
                })()}
                <span style={{ marginLeft: 8, fontSize: 10.5, color: '#94a3b8' }}>auto</span>
              </td>
              <td style={{ border: vBord, padding: '8px 10px', fontSize: 12, color: '#cbd5e1' }}>—</td>
              <td style={{ border: vBord, padding: '8px 10px', textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>
                {contraTotal > 0 ? fmtAmt(contraTotal) : '—'}
              </td>
              <td style={{ border: vBord, padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 700,
                color: direction === 'RECEIPT' ? '#1d4ed8' : '#15803d' }}>
                {direction === 'RECEIPT' ? 'DR' : 'CR'}
              </td>
            </tr>
          )}

          {/* Add line row */}
          <tr>
            <td colSpan={isMoneyVoucher ? 4 : 5} style={{ border: vBord, padding: '7px 10px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={addLine}
                  style={{ fontSize: 12.5, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                  <i className="ti ti-plus" style={{ fontSize: 14 }} /> Add Line
                </button>
                <span style={{ fontSize: 10.5, color: '#94a3b8' }}>⊕ = control account, Sub Account required</span>
              </div>
            </td>
          </tr>

          {/* Totals row */}
          <tr style={{ background: '#f1f5f9' }}>
            <td colSpan={2} style={{ border: vBord, padding: '8px 12px' }}>
              {!balanced && (totalDebit > 0 || totalCredit > 0) ? (
                <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                  ⚠ Difference: ₹{Math.abs(totalDebit - totalCredit).toFixed(2)}
                </span>
              ) : balanced && totalDebit > 0 ? (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Balanced</span>
              ) : null}
            </td>
            <td style={{ border: vBord, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>
                  DR {totalDebit > 0 ? `₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  CR {totalCredit > 0 ? `₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
            </td>
            <td colSpan={isMoneyVoucher ? 1 : 2} style={{ border: vBord, padding: '8px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
              {totalDebit > 0 ? fmtAmt(totalDebit) : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Error */}
      {formError && (
        <div style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '9px 13px', marginTop: 12 }}>
          {formError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={handleSave} disabled={isSaving}
          style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? 'Saving…' : editTarget ? 'Update Entry' : 'Post Entry'}
        </button>
        <button onClick={closeForm}
          style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );

  // ── Right panel: entry detail ─────────────────────────────────────────────
  const renderDetail = (entry: JournalEntry) => {
    const tc    = TYPE_STYLE[entry.type] ?? TYPE_STYLE['MANUAL'];
    const totDR = entry.lines.reduce((s, l) => s + Number(l.debit),  0);
    const totCR = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
    const bal   = Math.abs(totDR - totCR) < 0.005;

    return (
      <div style={{ padding: '22px 28px' }}>
        {/* Entry header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: tc.bg, color: tc.color }}>
                {tc.label}
              </span>
              {entry.reference_code && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 10px', borderRadius: 5, letterSpacing: '0.04em', fontFamily: 'monospace' }}>
                  {entry.reference_code}
                </span>
              )}
              {entry.reference_type && (
                <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                  {REF_LABELS[entry.reference_type] ?? entry.reference_type}
                </span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{entry.narration}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(entry.entry_date)}</div>
          </div>
          {entry.type === 'MANUAL' && (
            <button onClick={() => openEditForm(entry)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, cursor: 'pointer', flexShrink: 0 }}>
              <i className="ti ti-pencil" style={{ fontSize: 13 }} /> Edit
            </button>
          )}
        </div>

        {/* Lines table */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thSt}>Account</th>
                <th style={thSt}>Sub Account</th>
                <th style={{ ...thSt, textAlign: 'right', width: 120 }}>Debit (DR)</th>
                <th style={{ ...thSt, textAlign: 'right', width: 120 }}>Credit (CR)</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map(line => (
                <tr key={line.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 6 }}>
                      {line.account.code}
                    </span>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>{line.account.name}</span>
                    {line.narration && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>— {line.narration}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {line.business_partner ? (
                      <span style={{ fontSize: 11.5, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                        {line.business_partner.name}
                      </span>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: Number(line.debit) > 0 ? '#2563eb' : '#cbd5e1' }}>
                    {Number(line.debit) > 0 ? fmtAmt(Number(line.debit)) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: Number(line.credit) > 0 ? '#16a34a' : '#cbd5e1' }}>
                    {Number(line.credit) > 0 ? fmtAmt(Number(line.credit)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <td colSpan={2} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600 }}>
                  {bal
                    ? <span style={{ color: '#16a34a' }}>✓ Balanced</span>
                    : <span style={{ color: '#dc2626' }}>⚠ Not balanced</span>}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                  {fmtAmt(totDR)}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                  {fmtAmt(totCR)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ── Right panel: empty state ──────────────────────────────────────────────
  const renderEmpty = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
      <i className="ti ti-book-2" style={{ fontSize: 44, color: '#e2e8f0' }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>Select an entry to view</div>
      <div style={{ fontSize: 12.5, color: '#d1d5db' }}>or create a new manual entry</div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Journal Entries' }]} />

      <div style={{ display: 'flex', height: 'calc(100vh - 108px)', overflow: 'hidden' }}>

        {/* ═══ LEFT PANEL: entry list ═══════════════════════════════════════ */}
        <div style={{
          width: 320, flexShrink: 0,
          borderRight: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          background: '#f8fafc',
        }}>
          {/* Header + filters */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                Journal Entries
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 5 }}>
                  ({entries.length})
                </span>
              </span>
              <button onClick={openNewForm} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                <i className="ti ti-plus" style={{ fontSize: 13 }} /> New
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <select style={{ width: '100%', padding: '6px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#1e293b', background: '#fff', outline: 'none' }}
                value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
                <option value="">All types</option>
                <option value="AUTO">Auto-posted</option>
                <option value="MANUAL">Manual</option>
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="date" style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#1e293b', background: '#fff', outline: 'none' }}
                  value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
                <input type="date" style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#1e293b', background: '#fff', outline: 'none' }}
                  value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Scrollable entry list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            ) : entries.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6 }}>
                No entries found.
              </div>
            ) : (
              sortedDates.map(date => (
                <div key={date}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 14px 4px', background: '#f1f5f9', borderBottom: '1px solid #e9edf2' }}>
                    {fmtDate(date)}
                  </div>
                  {grouped[date].map(entry => {
                    const tc       = TYPE_STYLE[entry.type] ?? TYPE_STYLE['MANUAL'];
                    const isActive = entry.id === selectedId;
                    const amount   = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
                    return (
                      <div key={entry.id}
                        onClick={() => { setSelectedId(entry.id); setFormMode(null); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid #e2e8f0',
                          borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                          background: isActive ? '#eff6ff' : '#fff',
                          transition: 'background 0.12s, border-left-color 0.12s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: tc.bg, color: tc.color }}>
                            {tc.label}
                          </span>
                          {entry.reference_code && (
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#7c3aed', fontWeight: 600 }}>
                              {entry.reference_code}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                            {entry.narration}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                            ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL: detail / form / empty ══════════════════════════ */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          {formMode
            ? renderForm()
            : selectedEntry
              ? renderDetail(selectedEntry)
              : renderEmpty()}
        </div>

      </div>
    </Layout>
  );
}
