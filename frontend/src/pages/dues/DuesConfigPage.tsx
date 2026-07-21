import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDuesConfigQuery, useUpdateDuesConfigMutation } from '../../store/api/duesApi';

type ChargeType = 'FIXED' | 'RATE_PER_SQFT';
type PenaltyType = 'FLAT' | 'PERCENTAGE';

interface ConfigForm {
  charge_type: ChargeType;
  monthly_charge: string;
  rate_per_sqft: string;
  due_day: string;
  penalty_type: PenaltyType;
  penalty_value: string;
  penalty_grace_days: string;
  cash_balance: string;
  cash_balance_as_on: string;
}

const DEFAULT: ConfigForm = {
  charge_type: 'FIXED',
  monthly_charge: '',
  rate_per_sqft: '',
  due_day: '5',
  penalty_type: 'FLAT',
  penalty_value: '',
  penalty_grace_days: '5',
  cash_balance: '',
  cash_balance_as_on: '',
};

export default function DuesConfigPage() {
  const { data, isLoading } = useGetDuesConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateDuesConfigMutation();

  const [form, setForm] = useState<ConfigForm>(DEFAULT);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Populate form when config loads
  useEffect(() => {
    const cfg = data?.data as Record<string, unknown> | null | undefined;
    if (!cfg) return;
    setForm({
      charge_type: (cfg['charge_type'] as ChargeType) ?? 'FIXED',
      monthly_charge: cfg['monthly_charge'] != null ? String(cfg['monthly_charge']) : '',
      rate_per_sqft: cfg['rate_per_sqft'] != null ? String(cfg['rate_per_sqft']) : '',
      due_day: cfg['due_day'] != null ? String(cfg['due_day']) : '5',
      penalty_type: (cfg['penalty_type'] as PenaltyType) ?? 'FLAT',
      penalty_value: cfg['penalty_value'] != null ? String(cfg['penalty_value']) : '',
      penalty_grace_days: cfg['penalty_grace_days'] != null ? String(cfg['penalty_grace_days']) : '5',
      cash_balance: cfg['cash_balance'] != null ? String(cfg['cash_balance']) : '',
      cash_balance_as_on: cfg['cash_balance_as_on']
        ? (cfg['cash_balance_as_on'] as string).split('T')[0]
        : '',
    });
  }, [data]);

  const set = (k: keyof ConfigForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSuccess(false);
    setError('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess(false);

    if (form.charge_type === 'FIXED' && !form.monthly_charge) {
      setError('Monthly charge is required for Fixed fee type.');
      return;
    }
    if (form.charge_type === 'RATE_PER_SQFT' && !form.rate_per_sqft) {
      setError('Rate per sq ft is required for Rate per Sq Ft fee type.');
      return;
    }
    if (!form.penalty_value) {
      setError('Penalty value is required.');
      return;
    }

    try {
      await updateConfig({
        charge_type: form.charge_type,
        monthly_charge: form.charge_type === 'FIXED' ? parseFloat(form.monthly_charge) : 0,
        rate_per_sqft: form.charge_type === 'RATE_PER_SQFT' ? parseFloat(form.rate_per_sqft) : null,
        due_day: parseInt(form.due_day, 10),
        penalty_type: form.penalty_type,
        penalty_value: parseFloat(form.penalty_value),
        penalty_grace_days: parseInt(form.penalty_grace_days, 10),
        cash_balance: form.cash_balance ? parseFloat(form.cash_balance) : null,
        cash_balance_as_on: form.cash_balance_as_on || null,
      }).unwrap();
      setSuccess(true);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setError(err?.data?.message ?? 'Failed to save configuration.');
    }
  };

  return (
    <Layout>
      <PageSubHeader
        crumbs={[
          { label: 'Dues & Payments', to: '/dues' },
          { label: 'Configuration' },
        ]}
        onSave={handleSave}
        saveLabel="Save Configuration"
        saving={isSaving}
      />

      {isLoading ? (
        <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>Loading configuration…</div>
      ) : (
        <div style={{ padding: '1.5rem 2rem', maxWidth: 720 }}>

          {/* ── Monthly Fee ── */}
          <div className="ent-section" style={{ marginBottom: '1.5rem' }}>
            <div className="ent-section-hdr"><span className="ent-section-title">Monthly Maintenance Fee</span></div>
            <div style={{ padding: '1.25rem 1.5rem' }}>

              {/* Charge Type Toggle */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fee Calculation Method</div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {(['FIXED', 'RATE_PER_SQFT'] as ChargeType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => set('charge_type', ct)}
                      style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 6,
                        border: '2px solid',
                        borderColor: form.charge_type === ct ? 'var(--theme-accent)' : 'var(--color-border)',
                        background: form.charge_type === ct ? 'var(--theme-accent-light)' : '#fff',
                        color: form.charge_type === ct ? 'var(--theme-accent)' : 'var(--color-text)',
                        fontWeight: form.charge_type === ct ? 600 : 400,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {ct === 'FIXED' ? '₹ Fixed Amount' : '₹ Rate per Sq Ft'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.4rem' }}>
                  {form.charge_type === 'FIXED'
                    ? 'All apartments pay the same flat amount each month.'
                    : 'Amount is calculated as Rate × Area (sq ft) for each apartment.'}
                </div>
              </div>

              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {form.charge_type === 'FIXED' ? (
                  <div className="ent-fg">
                    <label className="ent-fl">Monthly Charge (₹) <span style={{ color: 'red' }}>*</span></label>
                    <input
                      className="ent-fc"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 2500"
                      value={form.monthly_charge}
                      onChange={(e) => set('monthly_charge', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="ent-fg">
                    <label className="ent-fl">Rate per Sq Ft (₹) <span style={{ color: 'red' }}>*</span></label>
                    <input
                      className="ent-fc"
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder="e.g. 2.50"
                      value={form.rate_per_sqft}
                      onChange={(e) => set('rate_per_sqft', e.target.value)}
                    />
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>
                      Units without area recorded will be skipped during generation.
                    </div>
                  </div>
                )}

                <div className="ent-fg">
                  <label className="ent-fl">Due Day of Month <span style={{ color: 'red' }}>*</span></label>
                  <input
                    className="ent-fc"
                    type="number"
                    min="1"
                    max="28"
                    placeholder="e.g. 5"
                    value={form.due_day}
                    onChange={(e) => set('due_day', e.target.value)}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>Day 1–28 to ensure all months are valid.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Late Payment Penalty ── */}
          <div className="ent-section" style={{ marginBottom: '1.5rem' }}>
            <div className="ent-section-hdr"><span className="ent-section-title">Late Payment Penalty</span></div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                A penalty is applied automatically after the grace period if the bill remains unpaid.
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Penalty Type</div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {(['FLAT', 'PERCENTAGE'] as PenaltyType[]).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => set('penalty_type', pt)}
                      style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 6,
                        border: '2px solid',
                        borderColor: form.penalty_type === pt ? 'var(--theme-accent)' : 'var(--color-border)',
                        background: form.penalty_type === pt ? 'var(--theme-accent-light)' : '#fff',
                        color: form.penalty_type === pt ? 'var(--theme-accent)' : 'var(--color-text)',
                        fontWeight: form.penalty_type === pt ? 600 : 400,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {pt === 'FLAT' ? '₹ Fixed Sum' : '% Percentage of Due'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="ent-fg">
                  <label className="ent-fl">
                    {form.penalty_type === 'FLAT' ? 'Penalty Amount (₹)' : 'Penalty Percentage (%)'}{' '}
                    <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="ent-fc"
                    type="number"
                    min="0"
                    step={form.penalty_type === 'PERCENTAGE' ? '0.01' : '1'}
                    placeholder={form.penalty_type === 'FLAT' ? 'e.g. 200' : 'e.g. 2'}
                    value={form.penalty_value}
                    onChange={(e) => set('penalty_value', e.target.value)}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>
                    {form.penalty_type === 'FLAT'
                      ? 'Fixed rupee amount added if payment is late.'
                      : 'Percentage of the outstanding due amount added if payment is late.'}
                  </div>
                </div>

                <div className="ent-fg">
                  <label className="ent-fl">Grace Period (days)</label>
                  <input
                    className="ent-fc"
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={form.penalty_grace_days}
                    onChange={(e) => set('penalty_grace_days', e.target.value)}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>
                    Days after due date before penalty is applied.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Cash / Bank Balance on Hand ── */}
          <div className="ent-section" style={{ marginBottom: '1.5rem' }}>
            <div className="ent-section-hdr"><span className="ent-section-title">Cash / Bank Balance on Hand</span></div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                Enter the association's cash or bank balance at the time of going live. This is a one-time entry captured during initial setup.
              </div>
              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="ent-fg">
                  <label className="ent-fl">Balance Amount (₹)</label>
                  <input
                    className="ent-fc"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 150000"
                    value={form.cash_balance}
                    onChange={(e) => set('cash_balance', e.target.value)}
                  />
                </div>
                <div className="ent-fg">
                  <label className="ent-fl">Balance As On</label>
                  <input
                    className="ent-fc"
                    type="date"
                    value={form.cash_balance_as_on}
                    onChange={(e) => set('cash_balance_as_on', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: '0.875rem', marginBottom: '1rem' }}>
              ✓ Configuration saved successfully.
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
