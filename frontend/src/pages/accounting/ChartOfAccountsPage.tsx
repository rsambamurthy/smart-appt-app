import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListAccountsQuery, useSeedAccountsMutation,
  useCreateAccountMutation, useUpdateAccountMutation,
  useToggleAccountMutation, useDeleteAccountMutation,
  useBackfillTransactionsMutation,
  useListBPTypesQuery, useCreateBPTypeMutation,
  Account, AccountType, BalanceType, BPType, BPSide, BackfillResult,
} from '../../store/api/accountingApi';

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_META: Record<AccountType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  ASSET:     { label: 'Assets',      icon: 'ti-building-bank',    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  LIABILITY: { label: 'Liabilities', icon: 'ti-arrow-down-circle',color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  INCOME:    { label: 'Income',      icon: 'ti-trending-up',      color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  EXPENSE:   { label: 'Expenses',    icon: 'ti-trending-down',    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  EQUITY:    { label: 'Equity',      icon: 'ti-scale',            color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
};
const TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];
const VALID_TYPES = new Set(TYPE_ORDER);
const SIDE_LABELS: Record<BPSide, string> = { RECEIVABLE: 'Receivable', PAYABLE: 'Payable', BOTH: 'Both' };

// ── Form types ────────────────────────────────────────────────────────────────
interface AccountForm {
  code: string; name: string; type: AccountType; sub_type: string; description: string;
  is_group: boolean; is_control_account: boolean; bp_type_id: string;
  opening_balance: string; opening_balance_type: BalanceType; opening_balance_date: string;
}
const emptyForm = (): AccountForm => ({
  code: '', name: '', type: 'ASSET', sub_type: '', description: '',
  is_group: false, is_control_account: false, bp_type_id: '',
  opening_balance: '', opening_balance_type: 'DR', opening_balance_date: '',
});

// ── Styles ────────────────────────────────────────────────────────────────────
const fl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };
const fc: React.CSSProperties = { width: '100%', padding: '6px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' };
const btn = (primary?: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7,
  border: primary ? 'none' : '1px solid #e2e8f0',
  background: primary ? '#2563eb' : '#fff', color: primary ? '#fff' : '#475569',
  fontSize: 13, fontWeight: primary ? 500 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
});

// ── Upload row type ───────────────────────────────────────────────────────────
interface UploadRow {
  code: string; name: string; type: string; sub_type?: string; description?: string;
  is_group?: string; is_control_account?: string;
  opening_balance?: string; opening_balance_type?: string; opening_balance_date?: string;
}
interface ParsedRow { valid: boolean; data: Partial<AccountForm>; error?: string; raw: UploadRow }

// ── Sub-component: AccountForm panel ─────────────────────────────────────────
function AccountFormPanel({
  form, onChange, onSave, onCancel, isSaving, error, bpTypes, isSystem, title,
}: {
  form: AccountForm;
  onChange: (f: AccountForm) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string;
  bpTypes: BPType[];
  isSystem?: boolean;
  title: string;
}) {
  const set = (patch: Partial<AccountForm>) => onChange({ ...form, ...patch });

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>{title}</div>

      {/* Row 1: Code / Name / Type / Sub-type */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px 1fr', gap: '0 10px', marginBottom: 10 }}>
        <div>
          <label style={fl}>Code</label>
          <input style={{ ...fc, background: isSystem ? '#f8fafc' : '#fff' }} value={form.code}
            readOnly={isSystem} onChange={e => set({ code: e.target.value })} placeholder="1006" />
        </div>
        <div>
          <label style={fl}>Name</label>
          <input style={fc} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Account name" />
        </div>
        <div>
          <label style={fl}>Type</label>
          <select style={{ ...fc, background: isSystem ? '#f8fafc' : '#fff' }} value={form.type}
            disabled={isSystem} onChange={e => set({ type: e.target.value as AccountType })}>
            {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </div>
        <div>
          <label style={fl}>Sub-type</label>
          <input style={fc} value={form.sub_type} onChange={e => set({ sub_type: e.target.value })} placeholder="e.g. Current Asset" />
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <label style={fl}>Description (optional)</label>
        <input style={fc} value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Brief description" />
      </div>

      {/* Sub-ledger linkage */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-hierarchy" style={{ fontSize: 13 }} aria-hidden="true" />
          Sub-ledger linkage
        </div>

        {/* Control account toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: form.is_control_account ? '#eff6ff' : '#f8fafc', border: `1px solid ${form.is_control_account ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 7, marginBottom: form.is_control_account ? 10 : 0, cursor: 'pointer' }}
          onClick={() => set({ is_control_account: !form.is_control_account, bp_type_id: '' })}>
          <div style={{ width: 34, height: 18, borderRadius: 99, background: form.is_control_account ? '#2563eb' : '#cbd5e1', position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
            <div style={{ position: 'absolute', top: 3, left: form.is_control_account ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>Control account</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>Journal lines on this account must reference a Business Partner</div>
          </div>
        </div>

        {/* BP Type selector — only when control account ON */}
        {form.is_control_account && (
          <div>
            <label style={fl}>Business partner type</label>
            <select style={{ ...fc, borderColor: '#93c5fd' }} value={form.bp_type_id}
              onChange={e => set({ bp_type_id: e.target.value })}>
              <option value="">— select type —</option>
              {bpTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({SIDE_LABELS[t.side]})</option>
              ))}
            </select>
            {bpTypes.length === 0 && (
              <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 4 }}>
                No BP types configured yet. Add them using the BP Types manager.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Opening balance — hidden for control accounts */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginBottom: 14 }}>
        {form.is_control_account ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7 }}>
            <i className="ti ti-info-circle" style={{ fontSize: 15, color: '#d97706', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#92400e' }}>Opening balance set at sub-account level</div>
              <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 2, lineHeight: 1.5 }}>
                For control accounts, set the opening balance on each Business Partner record — not here. The GL balance is the sum of all sub-accounts.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="ti ti-wallet" style={{ fontSize: 13 }} aria-hidden="true" />
              Opening balance <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 160px', gap: '0 10px' }}>
              <div>
                <label style={fl}>Amount (₹)</label>
                <input style={fc} type="number" value={form.opening_balance} placeholder="0.00"
                  onChange={e => set({ opening_balance: e.target.value })} />
              </div>
              <div>
                <label style={fl}>Side</label>
                <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', height: 31 }}>
                  {(['DR', 'CR'] as BalanceType[]).map(side => (
                    <button key={side} onClick={() => set({ opening_balance_type: side })} style={{
                      flex: 1, border: 'none', borderRight: side === 'DR' ? '1px solid #e2e8f0' : 'none',
                      background: form.opening_balance_type === side ? '#2563eb' : '#fff',
                      color: form.opening_balance_type === side ? '#fff' : '#475569',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}>{side}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={fl}>As-on date</label>
                <input style={fc} type="date" value={form.opening_balance_date}
                  onChange={e => set({ opening_balance_date: e.target.value })} />
              </div>
            </div>
          </>
        )}
      </div>

      {error && <div style={{ marginBottom: 10, fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} disabled={isSaving} style={{ ...btn(true), opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} style={btn()}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChartOfAccountsPage() {
  const { data, isLoading }                  = useListAccountsQuery();
  const { data: bpTypesData }                = useListBPTypesQuery();
  const [seedAccounts, { isLoading: isSeeding }] = useSeedAccountsMutation();
  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();
  const [updateAccount]                      = useUpdateAccountMutation();
  const [toggleAccount]                      = useToggleAccountMutation();
  const [deleteAccount]                      = useDeleteAccountMutation();
  const [createBPType]                       = useCreateBPTypeMutation();
  const [backfill, { isLoading: isBackfilling }] = useBackfillTransactionsMutation();

  const accounts = data?.data ?? [];
  const bpTypes  = bpTypesData?.data ?? [];
  const fileRef  = useRef<HTMLInputElement>(null);

  // ── Add form ─────────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState<AccountForm>(emptyForm());
  const [addError, setAddError] = useState('');

  // ── Edit form ─────────────────────────────────────────────────────────────────
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm, setEditForm]     = useState<AccountForm>(emptyForm());
  const [editError, setEditError]   = useState('');

  // ── Delete ────────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleteError, setDeleteError]   = useState('');

  // ── Upload ────────────────────────────────────────────────────────────────────
  const [showUpload, setShowUpload]       = useState(false);
  const [parsedRows, setParsedRows]       = useState<ParsedRow[]>([]);
  const [uploadError, setUploadError]     = useState('');
  const [uploading, setUploading]         = useState(false);
  const [uploadResult, setUploadResult]   = useState<{ created: number; skipped: number; failed: number } | null>(null);

  // ── Backfill ──────────────────────────────────────────────────────────────────
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [backfillError, setBackfillError]   = useState('');

  // ── New BP type inline ────────────────────────────────────────────────────────
  const [showNewBPType, setShowNewBPType]   = useState(false);
  const [newBPName, setNewBPName]           = useState('');
  const [newBPSide, setNewBPSide]           = useState<BPSide>('RECEIVABLE');

  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.type === type);
    return acc;
  }, {} as Record<AccountType, Account[]>);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    try { await seedAccounts().unwrap(); } catch { /* ignore */ }
  };

  const buildBody = (f: AccountForm) => ({
    code:                 f.code.trim(),
    name:                 f.name.trim(),
    type:                 f.type,
    sub_type:             f.sub_type || null,
    description:          f.description || null,
    is_group:             f.is_group,
    is_control_account:   f.is_control_account,
    bp_type_id:           f.is_control_account && f.bp_type_id ? f.bp_type_id : null,
    opening_balance:      (!f.is_control_account && f.opening_balance) ? parseFloat(f.opening_balance) : null,
    opening_balance_type: (!f.is_control_account && f.opening_balance) ? f.opening_balance_type : null,
    opening_balance_date: (!f.is_control_account && f.opening_balance_date) ? f.opening_balance_date : null,
  });

  const handleAdd = async () => {
    setAddError('');
    if (!addForm.code.trim()) { setAddError('Account code is required.'); return; }
    if (!addForm.name.trim()) { setAddError('Account name is required.'); return; }
    if (addForm.is_control_account && !addForm.bp_type_id) { setAddError('Select a Business Partner type for the control account.'); return; }
    try {
      await createAccount(buildBody(addForm)).unwrap();
      setAddForm(emptyForm()); setShowAdd(false);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setAddError(err?.data?.message ?? 'Failed to create account.');
    }
  };

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setEditForm({
      code:                 a.code,
      name:                 a.name,
      type:                 a.type,
      sub_type:             a.sub_type ?? '',
      description:          a.description ?? '',
      is_group:             a.is_group,
      is_control_account:   a.is_control_account,
      bp_type_id:           (a as any).bp_type_id ?? '',
      opening_balance:      a.opening_balance != null ? String(a.opening_balance) : '',
      opening_balance_type: a.opening_balance_type ?? 'DR',
      opening_balance_date: a.opening_balance_date ? a.opening_balance_date.slice(0, 10) : '',
    });
    setEditError('');
  };

  const handleSaveEdit = async (a: Account) => {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    if (editForm.is_control_account && !editForm.bp_type_id) { setEditError('Select a BP type.'); return; }
    try {
      await updateAccount({ id: a.id, body: buildBody(editForm) }).unwrap();
      setEditingId(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setEditError(err?.data?.message ?? 'Failed to update.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteAccount(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setDeleteError(err?.data?.message ?? 'Cannot delete this account.');
    }
  };

  const handleBackfill = async () => {
    setBackfillResult(null); setBackfillError('');
    try {
      const res = await backfill().unwrap();
      setBackfillResult(res.data);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setBackfillError(err?.data?.message ?? 'Sync failed.');
    }
  };

  // ── Download template ─────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = `${import.meta.env.BASE_URL}templates/SmartAppt_COAUpload_Template.xlsx`;
    a.download = 'SmartAppt_COAUpload_Template.xlsx';
    a.click();
  };

  // ── Parse upload file ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(''); setUploadResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<UploadRow>(ws, { defval: '' });
        const parsed: ParsedRow[] = raw
          .filter(r => r.code && String(r.code).trim() !== '' && String(r.code).toLowerCase() !== 'required')
          .map(r => {
            const code = String(r.code ?? '').trim();
            const name = String(r.name ?? '').trim();
            const type = String(r.type ?? '').trim().toUpperCase() as AccountType;
            if (!code) return { valid: false, data: {}, error: 'Code is required', raw: r };
            if (!name) return { valid: false, data: {}, error: `Row ${code}: name is required`, raw: r };
            if (!VALID_TYPES.has(type)) return { valid: false, data: {}, error: `Row ${code}: invalid type "${r.type}"`, raw: r };
            const isControl = String(r.is_control_account ?? '').toLowerCase() === 'yes';
            return {
              valid: true,
              raw: r,
              data: {
                code, name, type,
                sub_type:             String(r.sub_type ?? '').trim() || '',
                description:          String(r.description ?? '').trim() || '',
                is_group:             String(r.is_group ?? '').toLowerCase() === 'yes',
                is_control_account:   isControl,
                bp_type_id:           '',
                opening_balance:      (!isControl && r.opening_balance) ? String(r.opening_balance) : '',
                opening_balance_type: (String(r.opening_balance_type ?? '').toUpperCase() === 'CR' ? 'CR' : 'DR') as BalanceType,
                opening_balance_date: String(r.opening_balance_date ?? '').trim() || '',
              },
            };
          });
        setParsedRows(parsed);
      } catch {
        setUploadError('Failed to parse file. Make sure it is a valid .xlsx file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) return;
    setUploading(true);
    const result = { created: 0, skipped: 0, failed: 0 };
    for (const row of validRows) {
      try {
        await createAccount(buildBody(row.data as AccountForm)).unwrap();
        result.created++;
      } catch (e: unknown) {
        const err = e as { data?: { message?: string } };
        if (err?.data?.message?.includes('already exists')) result.skipped++;
        else result.failed++;
      }
    }
    setUploading(false);
    setUploadResult(result);
    setParsedRows([]);
  };

  const handleAddBPType = async () => {
    if (!newBPName.trim()) return;
    try {
      await createBPType({ name: newBPName.trim(), side: newBPSide }).unwrap();
      setNewBPName(''); setShowNewBPType(false);
    } catch { /* ignore */ }
  };

  // ── BP type name lookup ───────────────────────────────────────────────────────
  const bpTypeMap = Object.fromEntries(bpTypes.map(t => [t.id, t]));

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Accounting' }, { label: 'Chart of Accounts' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 960 }}>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: 13, color: '#64748b' }}>
            {accounts.length} accounts · {accounts.filter(a => a.is_active).length} active
          </div>
          <button onClick={handleSeed} disabled={isSeeding} style={btn()}>
            <i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true" />
            {isSeeding ? 'Seeding…' : 'Load standard accounts'}
          </button>
          <button onClick={downloadTemplate} style={btn()}>
            <i className="ti ti-download" style={{ fontSize: 15 }} aria-hidden="true" />
            Download template
          </button>
          <button onClick={() => { setShowUpload(v => !v); setUploadResult(null); setParsedRows([]); }} style={btn()}>
            <i className="ti ti-upload" style={{ fontSize: 15 }} aria-hidden="true" />
            Upload accounts
          </button>
          <button onClick={() => { setShowAdd(true); setAddError(''); setAddForm(emptyForm()); }} style={btn(true)}>
            <i className="ti ti-plus" style={{ fontSize: 15 }} aria-hidden="true" />
            Add account
          </button>
        </div>

        {/* ── Upload panel ── */}
        {showUpload && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Upload accounts</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
              Use the standard template. Existing account codes are skipped. Control account BP type linkage must be set manually after upload.
            </div>

            {/* Drop zone */}
            {parsedRows.length === 0 && !uploadResult && (
              <div
                style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: '24px', textAlign: 'center', background: '#f8fafc', cursor: 'pointer', marginBottom: 12 }}
                onClick={() => fileRef.current?.click()}
              >
                <i className="ti ti-file-spreadsheet" style={{ fontSize: 28, color: '#94a3b8', display: 'block', marginBottom: 6 }} aria-hidden="true" />
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Drop an .xlsx file here, or <span style={{ color: '#2563eb' }}>choose file</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>SmartAppt_COAUpload_Template.xlsx</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
            )}

            {uploadError && <div style={{ marginBottom: 10, fontSize: 12.5, color: '#dc2626' }}>{uploadError}</div>}

            {/* Parse preview */}
            {parsedRows.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'to create', n: parsedRows.filter(r => r.valid).length, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                    { label: 'errors',    n: parsedRows.filter(r => !r.valid).length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.n}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {parsedRows.filter(r => !r.valid).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {parsedRows.filter(r => !r.valid).map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#dc2626', padding: '2px 0' }}>⚠ {r.error}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleImport} disabled={uploading || parsedRows.filter(r => r.valid).length === 0} style={{ ...btn(true), opacity: uploading ? 0.7 : 1 }}>
                    {uploading ? 'Importing…' : `Import ${parsedRows.filter(r => r.valid).length} accounts`}
                  </button>
                  <button onClick={() => { setParsedRows([]); setUploadError(''); }} style={btn()}>Clear</button>
                </div>
              </>
            )}

            {/* Upload result */}
            {uploadResult && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Created', n: uploadResult.created, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                  { label: 'Skipped', n: uploadResult.skipped, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
                  { label: 'Failed',  n: uploadResult.failed,  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.n}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <button onClick={() => { setShowUpload(false); setUploadResult(null); setParsedRows([]); }} style={btn()}>Close</button>
            </div>
          </div>
        )}

        {/* ── Add form ── */}
        {showAdd && (
          <AccountFormPanel
            title="New account"
            form={addForm} onChange={setAddForm}
            onSave={handleAdd} onCancel={() => setShowAdd(false)}
            isSaving={isCreating} error={addError} bpTypes={bpTypes}
          />
        )}

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : (
          TYPE_ORDER.map(type => {
            const list = grouped[type];
            const meta = TYPE_META[type];
            return (
              <div key={type} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: meta.bg, borderBottom: `1px solid ${meta.border}` }}>
                  <i className={`ti ${meta.icon}`} style={{ fontSize: 16, color: meta.color }} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: meta.color, fontWeight: 500 }}>{list.length} account{list.length !== 1 ? 's' : ''}</span>
                </div>

                {list.length === 0 ? (
                  <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8' }}>No {meta.label.toLowerCase()} accounts yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Code', 'Name', 'Sub-type', 'Control / BP Type', 'Opening bal.', 'As-on date', 'Status', ''].map((h, i) => (
                          <th key={h} style={{ padding: '7px 12px', textAlign: i >= 4 && i <= 5 ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', width: i === 0 ? 72 : i === 7 ? 90 : 'auto' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((a, idx) => {
                        const isEditing = editingId === a.id;
                        const bpType    = (a as any).bp_type_id ? bpTypeMap[(a as any).bp_type_id] : null;
                        return (
                          <tr key={a.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', opacity: a.is_active ? 1 : 0.5 }}>
                            {isEditing ? (
                              <td colSpan={8} style={{ padding: '12px 14px' }}>
                                <AccountFormPanel
                                  title={`Edit — ${a.code} ${a.name}`}
                                  form={editForm} onChange={setEditForm}
                                  onSave={() => handleSaveEdit(a)} onCancel={() => setEditingId(null)}
                                  isSaving={false} error={editError} bpTypes={bpTypes} isSystem={a.is_system}
                                />
                              </td>
                            ) : (
                              <>
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#475569', fontSize: 12.5 }}>{a.code}</td>
                                <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: 500 }}>
                                  {a.name}
                                  {a.is_system && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '1px 5px', borderRadius: 4 }}>SYSTEM</span>}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12.5 }}>{a.sub_type ?? '—'}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  {a.is_control_account ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <span style={{ fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4 }}>CTRL</span>
                                      <span style={{ fontSize: 12, color: '#475569' }}>{bpType ? `${bpType.name}` : '—'}</span>
                                    </div>
                                  ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: a.is_control_account ? '#94a3b8' : '#1e293b', fontSize: 12.5, fontFamily: a.opening_balance != null ? 'monospace' : 'inherit' }}>
                                  {a.is_control_account ? '(sub-acct)' : a.opening_balance != null
                                    ? `₹${Number(a.opening_balance).toLocaleString('en-IN')} ${a.opening_balance_type}`
                                    : '—'}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: 12.5 }}>
                                  {a.opening_balance_date ? new Date(a.opening_balance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: a.is_active ? '#dcfce7' : '#f1f5f9', color: a.is_active ? '#15803d' : '#64748b' }}>
                                    {a.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="ent-ia ent-ia-edit" title="Edit" onClick={() => startEdit(a)}>✎</button>
                                    {!a.is_system && (
                                      <>
                                        {a.is_active
                                          ? <button className="ent-ia ent-ia-del" title="Deactivate" onClick={() => toggleAccount(a.id)}>⊗</button>
                                          : <button className="ent-ia ent-ia-edit" title="Activate" onClick={() => toggleAccount(a.id)}>↺</button>}
                                        <button className="ent-ia ent-ia-del" title="Delete" onClick={() => { setDeleteTarget(a); setDeleteError(''); }}>🗑</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}

        {/* ── BP Types manager ── */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 8, marginBottom: 14 }}>
          <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Business Partner Types</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Define types (Resident, Vendor, Bank…) used to link control accounts to their sub-ledger.</div>
            </div>
            <button onClick={() => setShowNewBPType(v => !v)} style={btn()}>
              <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
              Add type
            </button>
          </div>

          {showNewBPType && (
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={fl}>Name</label>
                <input style={{ ...fc, width: 180 }} value={newBPName} onChange={e => setNewBPName(e.target.value)} placeholder="e.g. Resident" />
              </div>
              <div>
                <label style={fl}>Side</label>
                <select style={{ ...fc, width: 140 }} value={newBPSide} onChange={e => setNewBPSide(e.target.value as BPSide)}>
                  <option value="RECEIVABLE">Receivable</option>
                  <option value="PAYABLE">Payable</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <button onClick={handleAddBPType} style={btn(true)}>Add</button>
              <button onClick={() => setShowNewBPType(false)} style={btn()}>Cancel</button>
            </div>
          )}

          {bpTypes.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 12.5, color: '#94a3b8' }}>No BP types yet. Add one to enable control account linkage.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Name', 'Side', 'Linked accounts', 'Status'].map(h => (
                    <th key={h} style={{ padding: '7px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bpTypes.map((t, idx) => {
                  const linked = accounts.filter(a => (a as any).bp_type_id === t.id).length;
                  return (
                    <tr key={t.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: '#1e293b' }}>{t.name}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                          background: t.side === 'RECEIVABLE' ? '#eff6ff' : t.side === 'PAYABLE' ? '#fef2f2' : '#f0fdf4',
                          color: t.side === 'RECEIVABLE' ? '#1d4ed8' : t.side === 'PAYABLE' ? '#dc2626' : '#16a34a' }}>
                          {SIDE_LABELS[t.side]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#64748b', fontSize: 12.5 }}>{linked} account{linked !== 1 ? 's' : ''}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: t.is_active ? '#dcfce7' : '#f1f5f9', color: t.is_active ? '#15803d' : '#64748b' }}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Sync existing transactions ── */}
        {accounts.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Sync existing transactions</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Post historical bills, payments, expenses, and receipts. Already-posted entries are skipped.</div>
              </div>
              <button onClick={handleBackfill} disabled={isBackfilling} style={{ ...btn(true), opacity: isBackfilling ? 0.7 : 1, marginLeft: 16 }}>
                {isBackfilling ? 'Syncing…' : '⟳ Sync to accounting'}
              </button>
            </div>
            {backfillError && <div style={{ padding: '10px 16px', background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{backfillError}</div>}
            {backfillResult && (() => {
              const rows = [
                { label: 'Bills',    r: backfillResult.bills    },
                { label: 'Payments', r: backfillResult.payments },
                { label: 'Expenses', r: backfillResult.expenses },
                { label: 'Receipts', r: backfillResult.receipts },
              ];
              return (
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Posted',  n: rows.reduce((s, x) => s + x.r.posted, 0),  bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
                      { label: 'Skipped', n: rows.reduce((s, x) => s + x.r.skipped, 0), bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' },
                      { label: 'Failed',  n: rows.reduce((s, x) => s + x.r.failed, 0),  bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.n}</div>
                        <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 10, padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete account?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              <strong>{deleteTarget.code} — {deleteTarget.name}</strong><br />
              This cannot be undone. Accounts with journal entries cannot be deleted.
            </div>
            {deleteError && <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 12 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDelete} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => { setDeleteTarget(null); setDeleteError(''); }} style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
