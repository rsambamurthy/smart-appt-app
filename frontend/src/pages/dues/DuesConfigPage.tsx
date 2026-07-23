import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListFeeConfigsQuery,
  useSaveFeeConfigsMutation,
  useDeleteFeeConfigMutation,
  type FeeConfigRow,
  type FeeType,
  type CalcMethod,
} from '../../store/api/duesApi';

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  MONTHLY_CHARGE: 'Monthly charge',
  PENALTY_AMOUNT: 'Penalty amount',
  CASH_OPENING_BALANCE: 'Cash opening balance',
};

const CALC_METHOD_LABELS: Record<CalcMethod, string> = {
  FIXED_AMOUNT: 'Fixed amount',
  RATE_PER_SQFT: 'Rate per sq ft',
};

const FEE_TYPES: FeeType[] = ['MONTHLY_CHARGE', 'PENALTY_AMOUNT', 'CASH_OPENING_BALANCE'];
const CALC_METHODS: CalcMethod[] = ['FIXED_AMOUNT', 'RATE_PER_SQFT'];

const isCash = (t: FeeType) => t === 'CASH_OPENING_BALANCE';

// ── Styles ────────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  textAlign: 'left',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-muted)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '0.55rem 0.85rem',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'middle',
};

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.65rem',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  fontSize: '0.875rem',
  background: 'var(--color-bg-card)',
  color: 'var(--color-text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle };

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: on ? '#22c55e' : '#cbd5e1',
        position: 'relative', transition: 'background 0.18s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 19 : 3,
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transition: 'left 0.16s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DuesConfigPage() {
  const { data, isLoading } = useListFeeConfigsQuery();
  const [saveConfigs, { isLoading: isSaving }] = useSaveFeeConfigsMutation();
  const [deleteConfig] = useDeleteFeeConfigMutation();

  const [rows, setRows] = useState<FeeConfigRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (data?.data) setRows(data.data);
  }, [data]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const activeTypesExcluding = (excludeIdx: number) =>
    rows
      .filter((r, i) => i !== excludeIdx && r.is_active)
      .map((r) => r.fee_type);

  const handleAddRow = () => {
    const activeFeeTypes = rows.filter((r) => r.is_active).map((r) => r.fee_type);
    const available = FEE_TYPES.find((t) => !activeFeeTypes.includes(t));
    if (!available) {
      setError('All fee types already have an active configuration. Deactivate one before adding another of the same type.');
      return;
    }
    setRows((prev) => [
      ...prev,
      { fee_type: available, calc_method: 'FIXED_AMOUNT', amount: 0, due_day: 5, as_on_date: null, is_active: true },
    ]);
    setError('');
    setSuccess('');
  };

  const updateRow = (i: number, patch: Partial<FeeConfigRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setError('');
    setSuccess('');
  };

  const handleTypeChange = (i: number, newType: FeeType) => {
    const blocked = activeTypesExcluding(i);
    if (rows[i].is_active && blocked.includes(newType)) {
      setError(`An active "${FEE_TYPE_LABELS[newType]}" config already exists. Deactivate it first.`);
      return;
    }
    updateRow(i, {
      fee_type: newType,
      calc_method: isCash(newType) ? null : 'FIXED_AMOUNT',
      due_day: isCash(newType) ? null : 5,
      as_on_date: isCash(newType) ? (rows[i].as_on_date ?? '') : null,
    });
  };

  const handleToggleActive = (i: number) => {
    const row = rows[i];
    if (!row.is_active) {
      // Re-activating — check if another active row of same type exists
      const blocked = activeTypesExcluding(i);
      if (blocked.includes(row.fee_type)) {
        setError(`An active "${FEE_TYPE_LABELS[row.fee_type]}" config already exists. Deactivate it first.`);
        return;
      }
    }
    updateRow(i, { is_active: !row.is_active });
  };

  const handleDelete = async (i: number) => {
    const row = rows[i];
    if (row.id) {
      try {
        await deleteConfig(row.id).unwrap();
      } catch {
        setError('Failed to delete row.');
        return;
      }
    }
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Client-side duplicate-active check
    const activeByType = new Map<FeeType, number>();
    for (const row of rows) {
      if (row.is_active) {
        activeByType.set(row.fee_type, (activeByType.get(row.fee_type) ?? 0) + 1);
      }
    }
    for (const [type, count] of activeByType) {
      if (count > 1) {
        setError(`Duplicate active config for "${FEE_TYPE_LABELS[type as FeeType]}". Deactivate one before saving.`);
        return;
      }
    }

    try {
      const saved = await saveConfigs(rows).unwrap();
      setRows(saved.data);
      setSuccess('Fee configuration saved.');
    } catch (e: unknown) {
      const err = e as { data?: { message?: string; detail?: string } };
      setError(err?.data?.message ?? err?.data?.detail ?? 'Failed to save.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'Configuration' }, { label: 'Fee Configuration' }]}
        onSave={handleSave}
        saveLabel="Save Configuration"
        saving={isSaving}
      />

      {isLoading ? (
        <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>Loading…</div>
      ) : (
        <div style={{ padding: '1.5rem 2rem' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Each fee type can have at most one <strong>active</strong> configuration at a time.
            </div>
            <button
              onClick={handleAddRow}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.45rem 1rem',
                border: '1px solid var(--color-border)',
                borderRadius: 6, background: 'var(--color-bg-card)',
                color: 'var(--color-text)', fontSize: '0.875rem',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span> Add fee config
            </button>
          </div>

          {/* Error / success banners */}
          {error && (
            <div style={{ marginBottom: '0.75rem', padding: '0.65rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginBottom: '0.75rem', padding: '0.65rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: '0.875rem' }}>
              ✓ {success}
            </div>
          )}

          {/* Table */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 190 }}>Fee type</th>
                  <th style={{ ...th, width: 175 }}>Calculation method</th>
                  <th style={{ ...th, width: 130 }}>Amount (₹)</th>
                  <th style={{ ...th, width: 100 }}>Due day</th>
                  <th style={{ ...th, width: 150 }}>As on date</th>
                  <th style={{ ...th, width: 110 }}>Status</th>
                  <th style={{ ...th, width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--color-muted)', padding: '2rem', borderBottom: 'none' }}>
                      No fee configurations yet. Click "+ Add fee config" to get started.
                    </td>
                  </tr>
                )}
                {rows.map((row, i) => (
                  <tr key={i} style={{ opacity: row.is_active ? 1 : 0.5 }}>

                    {/* Fee type */}
                    <td style={td}>
                      <select
                        style={selectStyle}
                        value={row.fee_type}
                        disabled={!row.is_active}
                        onChange={(e) => handleTypeChange(i, e.target.value as FeeType)}
                      >
                        {FEE_TYPES.map((t) => (
                          <option key={t} value={t}>{FEE_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>

                    {/* Calculation method */}
                    <td style={td}>
                      {isCash(row.fee_type) ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', background: 'var(--color-bg)', borderRadius: 4, padding: '3px 8px' }}>N/A</span>
                      ) : (
                        <select
                          style={selectStyle}
                          value={row.calc_method ?? 'FIXED_AMOUNT'}
                          disabled={!row.is_active}
                          onChange={(e) => updateRow(i, { calc_method: e.target.value as CalcMethod })}
                        >
                          {CALC_METHODS.map((m) => (
                            <option key={m} value={m}>{CALC_METHOD_LABELS[m]}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={td}>
                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount || ''}
                        disabled={!row.is_active}
                        placeholder="0"
                        onChange={(e) => updateRow(i, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </td>

                    {/* Due day */}
                    <td style={td}>
                      {isCash(row.fee_type) ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', background: 'var(--color-bg)', borderRadius: 4, padding: '3px 8px' }}>N/A</span>
                      ) : (
                        <input
                          style={inputStyle}
                          type="number"
                          min="1"
                          max="28"
                          value={row.due_day ?? ''}
                          disabled={!row.is_active}
                          placeholder="1–28"
                          onChange={(e) => updateRow(i, { due_day: parseInt(e.target.value, 10) || null })}
                        />
                      )}
                    </td>

                    {/* As on date */}
                    <td style={td}>
                      {isCash(row.fee_type) ? (
                        <input
                          style={inputStyle}
                          type="date"
                          value={row.as_on_date ?? ''}
                          disabled={!row.is_active}
                          onChange={(e) => updateRow(i, { as_on_date: e.target.value || null })}
                        />
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', background: 'var(--color-bg)', borderRadius: 4, padding: '3px 8px' }}>N/A</span>
                      )}
                    </td>

                    {/* Status toggle */}
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Toggle on={row.is_active} onChange={() => handleToggleActive(i)} />
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                          background: row.is_active ? '#f0fdf4' : '#f1f5f9',
                          color: row.is_active ? '#15803d' : '#64748b',
                        }}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>

                    {/* Delete */}
                    <td style={{ ...td, borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>
                      <button
                        onClick={() => handleDelete(i)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-muted)', fontSize: '1rem', padding: '4px 6px',
                          borderRadius: 4,
                        }}
                        title="Delete row"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
