import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListUsersQuery, useCreateUserMutation, useUpdateUserMutation, useDeactivateUserMutation,
  useListUnitsQuery, useBulkImportUsersMutation,
} from '../../store/api/usersApi';

// ─── Types ────────────────────────────────────────────────────────────────────

const ROLES = ['SUPER_USER', 'MANAGER', 'RESIDENT', 'COMMITTEE', 'TREASURER', 'GATE_STAFF'] as const;

const ROLE_BADGE: Record<string, string> = {
  SUPER_USER: 'badge-purple',
  MANAGER: 'badge-blue',
  RESIDENT: 'badge-green',
  COMMITTEE: 'badge-yellow',
  TREASURER: 'badge-yellow',
  GATE_STAFF: 'badge-gray',
};

type UserRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  unit_id?: string;
  is_owner: boolean;
  is_active: boolean;
  unit?: { id?: string; flat_number: string; block?: string };
};

type UnitRecord = {
  id: string;
  flat_number: string;
  block?: string;
  floor: number;
  area_sqft?: number | string;
  unit_type?: string;
  users: { id: string; name: string; phone: string; role: string; is_owner: boolean }[];
};

type UserForm = {
  phone: string; name: string; email: string;
  role: string; unit_id: string; is_owner: boolean;
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
        background: 'var(--color-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 50, padding: '1.5rem', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-muted)', padding: '0 0.25rem', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = true }:
  { message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; danger?: boolean }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--color-surface)', borderRadius: 'var(--radius)',
        padding: '1.75rem', zIndex: 70, width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <p style={{ marginBottom: '1.5rem', lineHeight: 1.6, fontSize: '0.9rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
      {message}
    </div>
  );
}

// ─── Bulk Import ─────────────────────────────────────────────────────────────

type BulkType = 'units' | 'users';
type ImportStep = 'upload' | 'preview' | 'result';

interface ParsedRow {
  _rowNum: number;
  _error: string | null;
  _data: Record<string, unknown>;
  [key: string]: unknown;
}

interface ImportResult { created: number; skipped: number; errors: string[] }

const UNIT_COLS = ['flat_number', 'block', 'floor', 'unit_type', 'area_sqft'];
const USER_COLS = ['name', 'phone', 'email', 'role', 'flat_number', 'block', 'is_owner'];
const VALID_ROLES = ['MANAGER', 'RESIDENT', 'COMMITTEE', 'TREASURER', 'GATE_STAFF'];

function downloadTemplate(type: BulkType) {
  const wb = XLSX.utils.book_new();
  const data = type === 'units'
    ? [UNIT_COLS, ['101', 'A', 1, '2BHK', 850], ['102', 'B', 2, '3BHK', 1200]]
    : [USER_COLS, ['John Doe', '9876543210', 'john@example.com', 'RESIDENT', '101', 'A', 'TRUE'],
       ['Jane Doe', '9876543211', '', 'TREASURER', '', '', 'FALSE']];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, type === 'units' ? 'Units' : 'Users');
  XLSX.writeFile(wb, `${type}_template.xlsx`);
}

function validateUnitRow(row: Record<string, unknown>): string | null {
  const flat = String(row['flat_number'] ?? '').trim();
  if (!flat) return 'flat_number is required';
  const floorRaw = row['floor'];
  if (floorRaw === '' || floorRaw === null || floorRaw === undefined) return 'floor is required';
  const floor = Number(floorRaw);
  if (isNaN(floor) || !Number.isInteger(floor) || floor < 0) return 'floor must be a whole number ≥ 0';
  const area = row['area_sqft'];
  if (area !== '' && area !== null && area !== undefined) {
    const a = Number(area);
    if (isNaN(a) || a <= 0) return 'area_sqft must be a positive number';
  }
  return null;
}

function validateUserRow(row: Record<string, unknown>, units: UnitRecord[]): string | null {
  const name = String(row['name'] ?? '').trim();
  if (!name) return 'name is required';
  const phone = String(row['phone'] ?? '').replace(/[\s\-()+]/g, '');
  if (!phone) return 'phone is required';
  if (!/^\d{10,15}$/.test(phone)) return 'phone must be 10–15 digits';
  const role = String(row['role'] ?? '').trim().toUpperCase();
  if (!VALID_ROLES.includes(role)) return `role must be one of: ${VALID_ROLES.join(', ')}`;
  const email = String(row['email'] ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'invalid email format';
  const flatNum = String(row['flat_number'] ?? '').trim();
  const block = String(row['block'] ?? '').trim();
  if (flatNum) {
    const found = units.find(u =>
      u.flat_number.toLowerCase() === flatNum.toLowerCase() &&
      (!block || (u.block ?? '').toLowerCase() === block.toLowerCase())
    );
    if (!found) return `Unit "${block ? block + '-' : ''}${flatNum}" not found`;
  }
  return null;
}

function toUnitRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    flat_number: String(row['flat_number']).trim(),
    block: String(row['block'] ?? '').trim() || undefined,
    floor: Number(row['floor']),
    unit_type: String(row['unit_type'] ?? '').trim() || undefined,
    area_sqft: row['area_sqft'] ? Number(row['area_sqft']) : undefined,
  };
}

function toUserRecord(row: Record<string, unknown>, units: UnitRecord[]): Record<string, unknown> {
  const flatNum = String(row['flat_number'] ?? '').trim();
  const block = String(row['block'] ?? '').trim();
  const unit = flatNum ? units.find(u =>
    u.flat_number.toLowerCase() === flatNum.toLowerCase() &&
    (!block || (u.block ?? '').toLowerCase() === block.toLowerCase())
  ) : undefined;
  const isOwnerStr = String(row['is_owner'] ?? '').trim().toLowerCase();
  return {
    name: String(row['name']).trim(),
    phone: String(row['phone']).trim(),
    email: String(row['email'] ?? '').trim() || undefined,
    role: String(row['role']).trim().toUpperCase(),
    unit_id: unit?.id,
    is_owner: ['true', '1', 'yes'].includes(isOwnerStr),
  };
}

function BulkImportModal({ type, units, onClose, onImport }: {
  type: BulkType;
  units: UnitRecord[];
  onClose: () => void;
  onImport: (records: object[]) => Promise<{ data: ImportResult }>;
}) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const cols = type === 'units' ? UNIT_COLS : USER_COLS;
  const validRows = rows.filter(r => !r._error);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (jsonRows.length === 0) { setParseError('No data rows found in the file.'); return; }
        const parsed: ParsedRow[] = jsonRows.map((row, i) => {
          const _error = type === 'units' ? validateUnitRow(row) : validateUserRow(row, units);
          const _data = type === 'units' ? toUnitRecord(row) : toUserRecord(row, units);
          return { _rowNum: i + 2, _error, _data, ...row };
        });
        setRows(parsed);
        setStep('preview');
      } catch {
        setParseError('Could not parse the file. Make sure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(validRows.map(r => r._data));
      setResult(res.data);
      setStep('result');
    } catch {
      setResult({ created: 0, skipped: validRows.length, errors: ['Import failed. Please try again.'] });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const modalWidth = step === 'preview' ? 720 : 440;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--color-surface)', borderRadius: 'var(--radius)',
        padding: '1.75rem', zIndex: 70, width: modalWidth, maxWidth: '95vw',
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {step === 'upload' && `Bulk Import ${type === 'units' ? 'Units' : 'Users'}`}
            {step === 'preview' && `Preview — ${rows.length} rows (${validRows.length} valid, ${rows.length - validRows.length} errors)`}
            {step === 'result' && 'Import Complete'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-muted)', lineHeight: 1 }}>×</button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
              Download the template, fill in your data, then upload the completed file.
              Supported formats: <strong>.xlsx</strong> and <strong>.csv</strong>
            </p>
            <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => downloadTemplate(type)}>
              ⬇ Download Template
            </button>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Upload File</label>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFile} style={{ padding: '0.4rem' }} />
            </div>
            {parseError && <ErrorBox message={parseError} />}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div>
            <div style={{ overflowX: 'auto', maxHeight: '52vh', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <table style={{ fontSize: '0.8rem', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>#</th>
                    {cols.map(c => (
                      <th key={c} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)', whiteSpace: 'nowrap' }}>{c}</th>
                    ))}
                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._rowNum} style={{ background: row._error ? '#fff7f7' : undefined }}>
                      <td style={{ padding: '5px 10px', color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{row._rowNum}</td>
                      {cols.map(c => (
                        <td key={c} style={{ padding: '5px 10px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                          {String(row[c] ?? '')}
                        </td>
                      ))}
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        {row._error
                          ? <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>✗ {row._error}</span>
                          : <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setStep('upload'); if (fileRef.current) fileRef.current.value = ''; }}>← Back</button>
              <button className="btn-primary" disabled={validRows.length === 0 || importing} onClick={handleImport}>
                {importing ? 'Importing…' : `Import ${validRows.length} valid row${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>{result.created}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Created</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706' }}>{result.skipped}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Skipped</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Errors ({result.errors.length}):</p>
                <div style={{ background: '#fff7f7', borderRadius: 6, padding: '0.75rem', maxHeight: 180, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 4 }}>• {e}</div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn-primary" style={{ alignSelf: 'flex-end' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

const BLANK_USER: UserForm = { phone: '', name: '', email: '', role: 'RESIDENT', unit_id: '', is_owner: false };

function UsersTab() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panel, setPanel] = useState<{ mode: 'add' | 'edit'; user?: UserRecord } | null>(null);
  const [confirm, setConfirm] = useState<{ userId: string; action: 'deactivate' | 'activate' } | null>(null);
  const [form, setForm] = useState<UserForm>(BLANK_USER);
  const [formError, setFormError] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  const queryParams: Record<string, unknown> = { limit: 500 };
  if (search) queryParams['search'] = search;
  if (roleFilter) queryParams['role'] = roleFilter;
  if (statusFilter !== '') queryParams['is_active'] = statusFilter === 'true';

  const { data, isFetching, refetch } = useListUsersQuery(queryParams);
  const { data: unitsData } = useListUnitsQuery();
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deactivateUser] = useDeactivateUserMutation();
  const [bulkImportUsers] = useBulkImportUsersMutation();

  const users = (data?.data ?? []) as UserRecord[];
  const units = (unitsData?.data ?? []) as UnitRecord[];

  const openAdd = () => { setForm(BLANK_USER); setFormError(''); setPanel({ mode: 'add' }); };
  const openEdit = (u: UserRecord) => {
    setForm({ phone: u.phone, name: u.name, email: u.email ?? '', role: u.role, unit_id: u.unit_id ?? '', is_owner: u.is_owner });
    setFormError('');
    setPanel({ mode: 'edit', user: u });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = {
        phone: form.phone, name: form.name,
        email: form.email || undefined,
        role: form.role, unit_id: form.unit_id || undefined, is_owner: form.is_owner,
      };
      if (panel?.mode === 'add') {
        await createUser(body).unwrap();
      } else if (panel?.user) {
        const { phone: _p, ...updateBody } = body;
        void _p;
        await updateUser({ id: panel.user.id, body: updateBody }).unwrap();
      }
      setPanel(null);
      refetch();
    } catch (err: unknown) {
      setFormError((err as { data?: { detail?: string } })?.data?.detail ?? 'An error occurred.');
    }
  };

  const handleToggleActive = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'deactivate') {
        await deactivateUser(confirm.userId).unwrap();
      } else {
        await updateUser({ id: confirm.userId, body: { is_active: true } }).unwrap();
      }
    } catch { /* ignore */ }
    setConfirm(null);
    refetch();
  };

  return (
    <>
      {/* Toolbar */}
      <div className="ent-toolbar">
        <input
          type="search"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }} onClick={() => downloadTemplate('users')}>⬇ Template</button>
        <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }} onClick={() => setShowBulkModal(true)}>📤 Bulk Upload</button>
        <button className="ent-btn-add" onClick={openAdd}>+ Add User</button>
      </div>

      {/* Table */}
      {isFetching ? (
        <div className="skeleton" style={{ height: 240, borderRadius: 6 }} />
      ) : users.length === 0 ? (
        <div className="ent-page-table" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          No users found.{' '}
          {!(search || roleFilter || statusFilter) && (
            <button className="ent-btn-add" onClick={openAdd} style={{ marginLeft: '0.5rem' }}>Add the first user</button>
          )}
        </div>
      ) : (
        <div className="ent-page-table">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {['Name', 'Phone', 'Email', 'Role', 'Unit', 'Status', 'Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const unitHref = u.unit?.id ? `/admin/units/${u.unit.id}` : undefined;
                  const unitLabel = u.unit
                    ? `${u.unit.block ? u.unit.block + '-' : ''}${u.unit.flat_number}`
                    : '—';
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td style={{ color: 'var(--color-muted)' }}>{u.phone}</td>
                      <td style={{ color: 'var(--color-muted)' }}>{u.email ?? '—'}</td>
                      <td><span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-gray'}`}>{u.role}</span></td>
                      <td>
                        {unitHref ? (
                          <Link to={unitHref} style={{ color: 'var(--theme-accent)', fontWeight: 500 }}>
                            {unitLabel}
                          </Link>
                        ) : unitLabel}
                        {u.unit && (
                          <span style={{ marginLeft: '0.35rem', color: 'var(--color-muted)', fontSize: '0.75rem' }}>
                            {u.is_owner ? '(Owner)' : '(Tenant)'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="ent-ia ent-ia-edit" onClick={() => openEdit(u)} title="Edit">✎</button>
                          {u.is_active ? (
                            <button className="ent-ia ent-ia-del" onClick={() => setConfirm({ userId: u.id, action: 'deactivate' })} title="Deactivate">⊗</button>
                          ) : (
                            <button className="ent-ia ent-ia-edit" onClick={() => setConfirm({ userId: u.id, action: 'activate' })} title="Activate">↺</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side panel */}
      {panel && (
        <SidePanel
          title={panel.mode === 'add' ? 'Add User' : `Edit — ${panel.user?.name}`}
          onClose={() => setPanel(null)}
        >
          {formError && <ErrorBox message={formError} />}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="form-group">
              <label>Phone *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required disabled={panel.mode === 'edit'} placeholder="+91 98765 43210" />
            </div>
            <div className="form-group">
              <label>Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Full name" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="optional" />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Unit / Flat</label>
              <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
                <option value="">— None —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.block ? `${u.block}-` : ''}{u.flat_number}{u.unit_type ? ` (${u.unit_type})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="is_owner_chk" checked={form.is_owner} onChange={(e) => setForm({ ...form, is_owner: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
              <label htmlFor="is_owner_chk" style={{ margin: 0, fontWeight: 400 }}>Owner (not a tenant)</label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={creating || updating}>
                {creating || updating ? 'Saving…' : panel.mode === 'add' ? 'Create User' : 'Save Changes'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPanel(null)}>Cancel</button>
            </div>
          </form>
        </SidePanel>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm.action === 'deactivate' ? 'Deactivate this user? They cannot log in until reactivated.' : 'Reactivate this user?'}
          confirmLabel={confirm.action === 'deactivate' ? 'Deactivate' : 'Activate'}
          danger={confirm.action === 'deactivate'}
          onConfirm={handleToggleActive}
          onCancel={() => setConfirm(null)}
        />
      )}

      {showBulkModal && (
        <BulkImportModal
          type="users"
          units={units}
          onClose={() => setShowBulkModal(false)}
          onImport={async (records) => {
            const res = await bulkImportUsers({ records }).unwrap();
            refetch();
            return res;
          }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  return (
    <Layout>
      <PageSubHeader
        crumbs={[
          { label: 'Admin', path: '/dashboard' },
          { label: 'Manage Users' },
        ]}
      />

      <div className="ent-page-hdr">
        <h1>Manage Users</h1>
        <p>Manage residents and staff for your association.</p>
      </div>

      <UsersTab />
    </Layout>
  );
}
