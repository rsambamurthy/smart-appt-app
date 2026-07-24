import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListUnitsQuery,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useDeleteUnitMutation,
  useBulkImportUnitsMutation,
} from '../../store/api/usersApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitRecord = {
  id: string;
  flat_number: string;
  block?: string;
  floor: number;
  area_sqft?: number | string;
  unit_type?: string;
  users: { id: string; name: string; is_owner: boolean; role: string }[];
};

type UnitForm = {
  flat_number: string;
  block: string;
  floor: string;
  area_sqft: string;
  unit_type: string;
};

const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', '4BHK', 'Studio', 'Penthouse', 'Villa'];
const BLANK: UnitForm = { flat_number: '', block: '', floor: '0', area_sqft: '', unit_type: '' };

type StatusFilter = 'all' | 'occupied' | 'vacant';

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

function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Confirm' }:
  { message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string }) {
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
          <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

// ─── Bulk Import ─────────────────────────────────────────────────────────────

interface ParsedRow {
  _rowNum: number;
  _error: string | null;
  _data: Record<string, unknown>;
  [key: string]: unknown;
}
interface ImportResult { created: number; skipped: number; errors: string[] }
const UNIT_COLS = ['flat_number', 'block', 'floor', 'unit_type', 'area_sqft'];

function downloadTemplate() {
  const filename = 'SmartAppt_UnitUpload_Template.xlsx';
  const a = document.createElement('a');
  a.href = `${import.meta.env.BASE_URL}templates/${filename}`;
  a.download = filename;
  a.click();
}

function validateRow(row: Record<string, unknown>): string | null {
  if (!String(row['flat_number'] ?? '').trim()) return 'flat_number is required';
  const floorRaw = row['floor'];
  if (floorRaw === '' || floorRaw == null) return 'floor is required';
  const floor = Number(floorRaw);
  if (isNaN(floor) || !Number.isInteger(floor) || floor < 0) return 'floor must be a whole number ≥ 0';
  const area = row['area_sqft'];
  if (area !== '' && area != null) {
    const a = Number(area);
    if (isNaN(a) || a <= 0) return 'area_sqft must be a positive number';
  }
  return null;
}

function BulkImportModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (records: object[]) => Promise<{ data: ImportResult }>;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
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
        if (!jsonRows.length) { setParseError('No data rows found.'); return; }
        setRows(jsonRows.map((row, i) => ({
          _rowNum: i + 2,
          _error: validateRow(row),
          _data: {
            flat_number: String(row['flat_number']).trim(),
            block: String(row['block'] ?? '').trim() || undefined,
            floor: Number(row['floor']),
            unit_type: String(row['unit_type'] ?? '').trim() || undefined,
            area_sqft: row['area_sqft'] ? Number(row['area_sqft']) : undefined,
          },
          ...row,
        })));
        setStep('preview');
      } catch { setParseError('Could not parse the file. Use a valid .xlsx or .csv file.'); }
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
    } finally { setImporting(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '1.75rem',
        zIndex: 70, width: step === 'preview' ? 680 : 420, maxWidth: '95vw',
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {step === 'upload' && 'Bulk Import Units'}
            {step === 'preview' && `Preview — ${rows.length} rows (${validRows.length} valid, ${rows.length - validRows.length} errors)`}
            {step === 'result' && 'Import Complete'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-muted)', lineHeight: 1 }}>×</button>
        </div>

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
              Download the template, fill in your data, then upload. Supported: <strong>.xlsx</strong> and <strong>.csv</strong>
            </p>
            <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={downloadTemplate}>⬇ Download Template</button>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Upload File</label>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFile} style={{ padding: '0.4rem' }} />
            </div>
            {parseError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem', borderRadius: 6, fontSize: '0.85rem' }}>{parseError}</div>}
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ overflowX: 'auto', maxHeight: '52vh', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <table style={{ fontSize: '0.8rem', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>#</th>
                    {UNIT_COLS.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)', whiteSpace: 'nowrap' }}>{c}</th>)}
                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._rowNum} style={{ background: row._error ? '#fff7f7' : undefined }}>
                      <td style={{ padding: '5px 10px', color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{row._rowNum}</td>
                      {UNIT_COLS.map(c => <td key={c} style={{ padding: '5px 10px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{String(row[c] ?? '')}</td>)}
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        {row._error ? <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>✗ {row._error}</span> : <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setStep('upload'); if (fileRef.current) fileRef.current.value = ''; }}>← Back</button>
              <button className="btn-primary" disabled={!validRows.length || importing} onClick={handleImport}>
                {importing ? 'Importing…' : `Import ${validRows.length} valid row${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

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
                  {result.errors.map((e, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: 4 }}>• {e}</div>)}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnitManagementPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [panel, setPanel] = useState<{ mode: 'add' | 'edit'; unit?: UnitRecord } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UnitRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [form, setForm] = useState<UnitForm>(BLANK);
  const [formError, setFormError] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  const { data, isFetching, refetch } = useListUnitsQuery();
  const [bulkImportUnits] = useBulkImportUnitsMutation();
  const [createUnit, { isLoading: creating }] = useCreateUnitMutation();
  const [updateUnit, { isLoading: updating }] = useUpdateUnitMutation();
  const [deleteUnit, { isLoading: deleting }] = useDeleteUnitMutation();

  const allUnits = (data?.data ?? []) as UnitRecord[];

  // Client-side filter
  const filtered = allUnits.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      `${u.block ?? ''}${u.flat_number}`.toLowerCase().includes(q) ||
      (u.unit_type ?? '').toLowerCase().includes(q) ||
      u.users.some((r) => r.name.toLowerCase().includes(q));
    const occupied = u.users.length > 0;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'occupied' && occupied) ||
      (statusFilter === 'vacant' && !occupied);
    return matchSearch && matchStatus;
  });

  // Summary stats
  const totalOccupied = allUnits.filter((u) => u.users.length > 0).length;
  const totalVacant = allUnits.length - totalOccupied;
  const totalResidents = allUnits.reduce((s, u) => s + u.users.length, 0);

  const unitLabel = (u: UnitRecord) => `${u.block ? u.block + '-' : ''}${u.flat_number}`;

  const openAdd = () => { setForm(BLANK); setFormError(''); setPanel({ mode: 'add' }); };
  const openEdit = (u: UnitRecord) => {
    setForm({
      flat_number: u.flat_number,
      block: u.block ?? '',
      floor: String(u.floor),
      area_sqft: u.area_sqft ? String(u.area_sqft) : '',
      unit_type: u.unit_type ?? '',
    });
    setFormError('');
    setPanel({ mode: 'edit', unit: u });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = {
        flat_number: form.flat_number,
        block: form.block || undefined,
        floor: parseInt(form.floor, 10),
        area_sqft: form.area_sqft ? parseFloat(form.area_sqft) : undefined,
        unit_type: form.unit_type || undefined,
      };
      if (panel?.mode === 'add') {
        await createUnit(body).unwrap();
      } else if (panel?.unit) {
        await updateUnit({ id: panel.unit.id, body }).unwrap();
      }
      setPanel(null);
      refetch();
    } catch (err: unknown) {
      setFormError(
        (err as { data?: { detail?: string } })?.data?.detail ?? 'An error occurred. Please try again.'
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteUnit({ id: deleteConfirm.id }).unwrap();
      setDeleteConfirm(null);
      refetch();
    } catch (err: unknown) {
      setDeleteError((err as { data?: { detail?: string } })?.data?.detail ?? 'Could not delete unit. It may have linked bills or payments.');
      setDeleteConfirm(null);
    }
  };

  return (
    <Layout>
      {/* Sub-header */}
      <PageSubHeader
        crumbs={[
          { label: 'Admin', path: '/dashboard' },
          { label: 'Manage Units' },
        ]}
      />

      {/* Page title */}
      <div className="ent-page-hdr">
        <h1>Manage Units</h1>
        <p>Apartment units and flat assignments for your association.</p>
      </div>

      {deleteError && (
        <div style={{ margin: '0 1.5rem', background: '#fee2e2', color: '#991b1b', padding: '0.65rem 1rem', borderRadius: 6, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#991b1b', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Stats meta bar */}
      <div className="ent-meta">
        <div>
          <div className="ent-meta-label">Total Units</div>
          <div className="ent-meta-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--theme-accent)' }}>
            {allUnits.length}
          </div>
        </div>
        <div>
          <div className="ent-meta-label">Occupied</div>
          <div className="ent-meta-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a' }}>
            {totalOccupied}
          </div>
        </div>
        <div>
          <div className="ent-meta-label">Vacant</div>
          <div className="ent-meta-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#d97706' }}>
            {totalVacant}
          </div>
        </div>
        <div>
          <div className="ent-meta-label">Total Residents</div>
          <div className="ent-meta-value" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            {totalResidents}
          </div>
        </div>
      </div>

      {/* Units section card */}
      <div className="ent-section">
        <div className="ent-section-hdr">
          <span className="ent-section-title">All Units</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }} onClick={downloadTemplate}>⬇ Template</button>
            <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }} onClick={() => setShowBulkModal(true)}>📤 Bulk Upload</button>
            <button className="ent-btn-add" onClick={openAdd}>+ Add Unit</button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <input
            type="search"
            className="ent-fc"
            placeholder="Search flat, block, type, resident…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 200px', height: 32 }}
          />
          <select
            className="ent-fc"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{ width: 'auto', height: 32, flex: '0 0 auto' }}
          >
            <option value="all">All Status</option>
            <option value="occupied">Occupied</option>
            <option value="vacant">Vacant</option>
          </select>
        </div>

        {/* Table */}
        {isFetching ? (
          <div className="skeleton" style={{ height: 240, margin: 16, borderRadius: 6 }} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            {allUnits.length === 0
              ? <><span>No units yet. </span><button className="ent-btn-add" onClick={openAdd}>Add the first unit</button></>
              : 'No units match your search.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Flat', 'Block', 'Floor', 'Type', 'Area', 'Residents', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 14px', textAlign: 'left',
                        background: '#f7f9fd', fontWeight: 600,
                        color: 'var(--color-muted)', fontSize: '11.5px',
                        borderBottom: '2px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const occupied = u.users.length > 0;
                  return (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid #f0f4f8' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafd')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {/* Flat */}
                      <td data-label="Flat" style={{ padding: '10px 14px', fontWeight: 700 }}>
                        <Link
                          to={`/admin/units/${u.id}`}
                          style={{ color: 'var(--theme-accent)', textDecoration: 'none' }}
                        >
                          {unitLabel(u)}
                        </Link>
                      </td>

                      {/* Block */}
                      <td data-label="Block" style={{ padding: '10px 14px', color: 'var(--color-muted)' }}>
                        {u.block ?? '—'}
                      </td>

                      {/* Floor */}
                      <td data-label="Floor" style={{ padding: '10px 14px', color: 'var(--color-muted)' }}>
                        {u.floor}
                      </td>

                      {/* Type */}
                      <td data-label="Type" style={{ padding: '10px 14px' }}>
                        {u.unit_type
                          ? <span className="badge badge-blue">{u.unit_type}</span>
                          : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                      </td>

                      {/* Area */}
                      <td data-label="Area" style={{ padding: '10px 14px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {u.area_sqft ? `${u.area_sqft} sqft` : '—'}
                      </td>

                      {/* Residents */}
                      <td data-label="Residents" style={{ padding: '10px 14px', maxWidth: 200 }}>
                        {u.users.length === 0 ? (
                          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>Unoccupied</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {u.users.slice(0, 3).map((r) => (
                              <span
                                key={r.id}
                                style={{
                                  background: 'var(--color-bg)',
                                  borderRadius: 4,
                                  padding: '1px 7px',
                                  fontSize: 11.5,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {r.name}
                                <span style={{ color: 'var(--color-muted)', marginLeft: 3 }}>
                                  {r.is_owner ? '(O)' : '(T)'}
                                </span>
                              </span>
                            ))}
                            {u.users.length > 3 && (
                              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                                +{u.users.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td data-label="Status" style={{ padding: '10px 14px' }}>
                        {occupied
                          ? <span className="ent-status-active">● Occupied</span>
                          : <span className="ent-status-vacant">● Vacant</span>}
                      </td>

                      {/* Actions */}
                      <td data-label="Actions" style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Link
                            to={`/admin/units/${u.id}`}
                            style={{
                              padding: '3px 9px', background: 'var(--theme-accent-light)',
                              color: 'var(--theme-accent)', borderRadius: 4,
                              fontSize: 11.5, fontWeight: 600, textDecoration: 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >View</Link>
                          <button
                            className="ent-ia ent-ia-edit"
                            onClick={() => openEdit(u)}
                            title="Edit unit"
                          >✎</button>
                          <button
                            className="ent-ia ent-ia-del"
                            onClick={() => setDeleteConfirm(u)}
                            disabled={occupied}
                            title={occupied ? 'Remove residents before deleting' : 'Delete unit'}
                            style={{ opacity: occupied ? 0.35 : 1 }}
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div style={{
            padding: '8px 14px', fontSize: 11.5, color: 'var(--color-muted)',
            borderTop: '1px solid var(--color-border)', background: '#f8fafd',
          }}>
            Showing {filtered.length} of {allUnits.length} units
          </div>
        )}
      </div>

      {/* ── Add / Edit side panel ── */}
      {panel && (
        <SidePanel
          title={
            panel.mode === 'add'
              ? 'Add Unit'
              : `Edit Unit — ${unitLabel(panel.unit!)}`
          }
          onClose={() => setPanel(null)}
        >
          {formError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="form-group">
              <label>Flat Number *</label>
              <input
                type="text"
                value={form.flat_number}
                onChange={(e) => setForm({ ...form, flat_number: e.target.value })}
                required
                placeholder="e.g. 101"
              />
            </div>
            <div className="form-group">
              <label>Block</label>
              <input
                type="text"
                value={form.block}
                onChange={(e) => setForm({ ...form, block: e.target.value })}
                placeholder="e.g. A, B, East Wing"
              />
            </div>
            <div className="form-group">
              <label>Floor *</label>
              <input
                type="number"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                required
                min={0}
              />
            </div>
            <div className="form-group">
              <label>Unit Type</label>
              <select
                value={form.unit_type}
                onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
              >
                <option value="">— Select —</option>
                {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Area (sqft)</label>
              <input
                type="number"
                value={form.area_sqft}
                onChange={(e) => setForm({ ...form, area_sqft: e.target.value })}
                min={0}
                step="0.01"
                placeholder="optional"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={creating || updating}
              >
                {creating || updating
                  ? 'Saving…'
                  : panel.mode === 'add' ? 'Create Unit' : 'Save Changes'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPanel(null)}>
                Cancel
              </button>
            </div>
          </form>
        </SidePanel>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <ConfirmModal
          message={`Delete unit ${unitLabel(deleteConfirm)} permanently? This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {showBulkModal && (
        <BulkImportModal
          onClose={() => setShowBulkModal(false)}
          onImport={async (records) => {
            const res = await bulkImportUnits({ records }).unwrap();
            refetch();
            return res;
          }}
        />
      )}
    </Layout>
  );
}
