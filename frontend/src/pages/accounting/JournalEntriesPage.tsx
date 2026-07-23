import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListJournalEntriesQuery, useCreateJournalEntryMutation,
  useUpdateJournalEntryMutation,
  useListAccountsQuery,
  JournalEntry, JournalLineInput,
} from '../../store/api/accountingApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => n > 0 ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const REF_LABELS: Record<string, string> = {
  DUES_BILL:       'Dues Bill',
  PAYMENT:         'Payment',
  EXPENSE:         'Expense',
  OTHER_RECEIPT:   'Other Receipt',
  OPENING_BALANCE: 'Opening Balance',
  MANUAL:          'Manual',
};

const TYPE_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  AUTO:   { bg: '#eff6ff', color: '#2563eb', label: 'Auto' },
  MANUAL: { bg: '#f5f3ff', color: '#7c3aed', label: 'Manual' },
};

// ── Empty line ────────────────────────────────────────────────────────────────
const emptyLine = (): JournalLineInput & { _key: number } => ({
  _key: Date.now() + Math.random(),
  account_id: '',
  debit:  0,
  credit: 0,
  narration: '',
});

// ── Shared input style ────────────────────────────────────────────────────────
const fc: React.CSSProperties = {
  width: '100%', padding: '6px 9px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 12.5, color: '#1e293b', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
};

export default function JournalEntriesPage() {
  const [filter, setFilter] = useState<{ type: string; from: string; to: string }>({ type: '', from: '', to: '' });
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<JournalEntry | null>(null);

  const { data, isLoading, refetch } = useListJournalEntriesQuery({
    type: filter.type || undefined,
    from: filter.from || undefined,
    to:   filter.to   || undefined,
  });
  const { data: accountsData } = useListAccountsQuery();
  const [createEntry, { isLoading: isCreating }] = useCreateJournalEntryMutation();
  const [updateEntry, { isLoading: isUpdating }] = useUpdateJournalEntryMutation();
  const isSaving = isCreating || isUpdating;

  const entries  = data?.data ?? [];
  const accounts = accountsData?.data ?? [];

  // ── Form state ───────────────────────────────────────────────────────────
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines]         = useState([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState('');

  const openNewForm = () => {
    setEditTarget(null);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setNarration('');
    setLines([emptyLine(), emptyLine()]);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (entry: JournalEntry) => {
    setEditTarget(entry);
    setEntryDate(entry.entry_date.slice(0, 10));
    setNarration(entry.narration);
    setLines(entry.lines.map(l => ({
      _key: Math.random(),
      account_id: l.account_id,
      debit:      Number(l.debit),
      credit:     Number(l.credit),
      narration:  l.narration ?? '',
    })));
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditTarget(null); };

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };
  const addLine    = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (idx: number) => setLines(ls => ls.filter((_, i) => i !== idx));

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.005;

  const handleSave = async () => {
    setFormError('');
    if (!narration.trim()) { setFormError('Narration is required.'); return; }
    if (lines.some(l => !l.account_id)) { setFormError('All lines must have an account.'); return; }
    if (!balanced) { setFormError(`Unbalanced: debit ₹${totalDebit.toFixed(2)} ≠ credit ₹${totalCredit.toFixed(2)}`); return; }
    if (totalDebit === 0) { setFormError('Entry amount cannot be zero.'); return; }

    const payload = {
      entry_date: entryDate,
      narration,
      lines: lines.map(({ account_id, debit, credit, narration: ln }) => ({
        account_id,
        debit:    Number(debit)  || 0,
        credit:   Number(credit) || 0,
        narration: ln || undefined,
      })),
    };

    try {
      if (editTarget) {
        await updateEntry({ id: editTarget.id, ...payload }).unwrap();
      } else {
        await createEntry(payload).unwrap();
      }
      closeForm();
      refetch();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setFormError(err?.data?.message ?? 'Failed to save entry.');
    }
  };

  // ── Group entries by date ────────────────────────────────────────────────
  const grouped = entries.reduce((acc, e) => {
    const d = e.entry_date.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {} as Record<string, JournalEntry[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Journal Entries' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 960 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...fc, width: 130 }} value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
            <option value="">All types</option>
            <option value="AUTO">Auto-posted</option>
            <option value="MANUAL">Manual</option>
          </select>
          <input type="date" style={{ ...fc, width: 145 }} value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
          <input type="date" style={{ ...fc, width: 145 }} value={filter.to}   onChange={e => setFilter(f => ({ ...f, to:   e.target.value }))} />
          <div style={{ flex: 1, fontSize: 12.5, color: '#64748b' }}>{entries.length} entries</div>
          <button onClick={openNewForm} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7, border: 'none',
            background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            <i className="ti ti-plus" style={{ fontSize: 15 }} /> Add Manual Entry
          </button>
        </div>

        {/* Entry form (new or edit) */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px', marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
              {editTarget ? 'Edit Journal Entry' : 'New Journal Entry'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0 12px', marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" style={fc} value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Narration</label>
                <input style={fc} value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description of this entry" />
              </div>
            </div>

            {/* Lines */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 10 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Account</th>
                  <th style={{ padding: '6px 10px', width: 130, fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Debit (DR)</th>
                  <th style={{ padding: '6px 10px', width: 130, fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Credit (CR)</th>
                  <th style={{ padding: '6px 10px', width: 180, fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Note</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line._key} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '5px 8px' }}>
                      <select style={fc} value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)}>
                        <option value="">— Select account —</option>
                        {['ASSET','LIABILITY','INCOME','EXPENSE','EQUITY'].map(type => (
                          <optgroup key={type} label={type}>
                            {accounts.filter(a => a.type === type && a.is_active).map(a => (
                              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <input type="number" min="0" step="0.01" style={{ ...fc, textAlign: 'right' }}
                        value={line.debit || ''} onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <input type="number" min="0" step="0.01" style={{ ...fc, textAlign: 'right' }}
                        value={line.credit || ''} onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <input style={fc} value={line.narration ?? ''} onChange={e => updateLine(idx, 'narration', e.target.value)} placeholder="Optional" />
                    </td>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Total</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                    {totalDebit > 0 ? `₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                    {totalCredit > 0 ? `₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td colSpan={2} style={{ padding: '7px 10px' }}>
                    {!balanced && totalDebit > 0 && (
                      <span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
                        Diff: ₹{Math.abs(totalDebit - totalCredit).toFixed(2)}
                      </span>
                    )}
                    {balanced && totalDebit > 0 && (
                      <span style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>✓ Balanced</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <button onClick={addLine} style={{ fontSize: 12.5, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-plus" /> Add line
            </button>

            {formError && <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 10 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={isSaving} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {isSaving ? 'Saving…' : editTarget ? 'Update Entry' : 'Post Entry'}
              </button>
              <button onClick={closeForm} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Entry list */}
        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '3rem 0', textAlign: 'center', fontSize: 13 }}>
            No journal entries yet. Entries are auto-posted when bills, payments, expenses and receipts are recorded.
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} style={{ marginBottom: 18 }}>
              {/* Date header */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px 6px' }}>
                {fmtDate(date)}
              </div>

              {grouped[date].map(entry => {
                const tc = TYPE_COLOR[entry.type] ?? TYPE_COLOR['MANUAL'];
                return (
                  <div key={entry.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                    {/* Entry header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: tc.bg, color: tc.color }}>
                        {tc.label}
                      </span>
                      {entry.reference_type && (
                        <span style={{ fontSize: 11.5, color: '#64748b', background: '#f8fafc', padding: '2px 7px', borderRadius: 5 }}>
                          {REF_LABELS[entry.reference_type] ?? entry.reference_type}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 1 }}>{entry.narration}</span>
                      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                        {new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* Edit button */}
                      <button
                        className="ent-ia ent-ia-edit"
                        title="Edit entry"
                        onClick={() => openEditForm(entry)}
                        style={{ marginLeft: 4 }}
                      ><i className="ti ti-pencil" /></button>
                    </div>

                    {/* Lines */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <tbody>
                        {entry.lines.map(line => {
                          const isDebit = Number(line.debit) > 0;
                          return (
                            <tr key={line.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '7px 14px', paddingLeft: isDebit ? 14 : 32, color: '#475569' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginRight: 6 }}>{line.account.code}</span>
                                {line.account.name}
                                {line.narration && <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>— {line.narration}</span>}
                              </td>
                              <td style={{ padding: '7px 14px', textAlign: 'right', width: 120, fontWeight: 600, color: '#2563eb' }}>
                                {isDebit ? fmt(Number(line.debit)) : ''}
                              </td>
                              <td style={{ padding: '7px 14px', textAlign: 'right', width: 120, fontWeight: 600, color: '#16a34a' }}>
                                {!isDebit ? fmt(Number(line.credit)) : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
