import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDuesConfigQuery, useUpdateDuesConfigMutation } from '../../store/api/duesApi';

const card: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.5rem',
  marginBottom: '1.25rem',
};
const sectionTitle: React.CSSProperties = {
  fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--color-muted)', marginBottom: '1rem',
};
const rowGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
};
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const lbl: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: 6,
  fontSize: '0.875rem', background: 'var(--color-bg-card)', color: 'var(--color-text)',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

interface ConfigForm {
  charge_type: 'FIXED' | 'RATE_PER_SQFT';
  monthly_charge: string;
  rate_per_sqft: string;
  due_day: string;
  penalty_type: 'FLAT' | 'PERCENTAGE';
  penalty_value: string;
  penalty_grace_days: string;
  cash_balance: string;
  cash_balance_as_on: string;
}

const EMPTY: ConfigForm = {
  charge_type: 'FIXED', monthly_charge: '', rate_per_sqft: '', due_day: '5',
  penalty_type: 'FLAT', penalty_value: '', penalty_grace_days: '5',
  cash_balance: '', cash_balance_as_on: '',
};

export default function DuesConfigPage() {
  const { data, isLoading } = useGetDuesConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateDuesConfigMutation();
  const [form, setForm] = useState<ConfigForm>(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const cfg = (data as { data: Record<string, unknown> } | undefined)?.data;
    if (!cfg) return;
    setForm({
      charge_type: (cfg.charge_type as string) === 'RATE_PER_SQFT' ? 'RATE_PER_SQFT' : 'FIXED',
      monthly_charge: cfg.monthly_charge != null ? String(cfg.monthly_charge) : '',
      rate_per_sqft: cfg.rate_per_sqft != null ? String(cfg.rate_per_sqft) : '',
      due_day: cfg.due_day != null ? String(cfg.due_day) : '5',
      penalty_type: (cfg.penalty_type as string) === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT',
      penalty_value: cfg.penalty_value != null ? String(cfg.penalty_value) : '',
      penalty_grace_days: cfg.penalty_grace_days != null ? String(cfg.penalty_grace_days) : '5',
      cash_balance: cfg.cash_balance != null ? String(cfg.cash_balance) : '',
      cash_balance_as_on: cfg.cash_balance_as_on ? (cfg.cash_balance_as_on as string).split('T')[0] : '',
    });
  }, [data]);

  const set = (k: keyof ConfigForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(''); setSuccess('');
  };

  const handleSave = async () => {
    setError(''); setSuccess('');
    try {
      await updateConfig({
        charge_type: form.charge_type,
        monthly_charge: parseFloat(form.monthly_charge) || 0,
        rate_per_sqft: form.charge_type === 'RATE_PER_SQFT' ? (parseFloat(form.rate_per_sqft) || null) : null,
        due_day: parseInt(form.due_day, 10) || 5,
        penalty_type: form.penalty_type,
        penalty_value: parseFloat(form.penalty_value) || 0,
        penalty_grace_days: parseInt(form.penalty_grace_days, 10) || 0,
        cash_balance: form.cash_balance !== '' ? parseFloat(form.cash_balance) : null,
        cash_balance_as_on: form.cash_balance_as_on || null,
      }).unwrap();
      setSuccess('Fee configuration saved.');
    } catch (e: unknown) {
      const err = e as { data?: { message?: string; detail?: string } };
      setError(err?.data?.message ?? err?.data?.detail ?? 'Failed to save.');
    }
  };

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'Configuration' }, { label: 'Fee Configuration' }]}
        onSave={handleSave} saveLabel="Save Configuration" saving={isSaving}
      />
      {isLoading ? (
        <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>Loading…</div>
      ) : (
        <div style={{ padding: '1.5rem 2rem', maxWidth: 900 }}>
          {error && <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>}
          {success && <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: '0.875rem' }}>✓ {success}</div>}

          <div style={card}>
            <div style={sectionTitle}>Monthly Charge</div>
            <div style={rowGrid}>
              <div style={fieldWrap}>
                <label style={lbl}>Charge type</label>
                <select style={inputStyle} value={form.charge_type} onChange={(e) => set('charge_type', e.target.value)}>
                  <option value="FIXED">Fixed amount</option>
                  <option value="RATE_PER_SQFT">Rate per sq ft</option>
                </select>
              </div>
              {form.charge_type === 'FIXED' ? (
                <div style={fieldWrap}>
                  <label style={lbl}>Monthly charge (₹)</label>
                  <input style={inputStyle} type="number" min="0" step="0.01"
                    value={form.monthly_charge} placeholder="e.g. 2500"
                    onChange={(e) => set('monthly_charge', e.target.value)} />
                </div>
              ) : (
                <div style={fieldWrap}>
                  <label style={lbl}>Rate per sq ft (₹)</label>
                  <input style={inputStyle} type="number" min="0" step="0.01"
                    value={form.rate_per_sqft} placeholder="e.g. 2.50"
                    onChange={(e) => set('rate_per_sqft', e.target.value)} />
                </div>
              )}
              <div style={fieldWrap}>
                <label style={lbl}>Due day of month</label>
                <input style={inputStyle} type="number" min="1" max="28"
                  value={form.due_day} placeholder="1–28"
                  onChange={(e) => set('due_day', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Penalty</div>
            <div style={rowGrid}>
              <div style={fieldWrap}>
                <label style={lbl}>Penalty type</label>
                <select style={inputStyle} value={form.penalty_type} onChange={(e) => set('penalty_type', e.target.value)}>
                  <option value="FLAT">Flat amount</option>
                  <option value="PERCENTAGE">Percentage</option>
                </select>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>{form.penalty_type === 'PERCENTAGE' ? 'Penalty %' : 'Penalty amount (₹)'}</label>
                <input style={inputStyle} type="number" min="0" step="0.01"
                  value={form.penalty_value}
                  placeholder={form.penalty_type === 'PERCENTAGE' ? 'e.g. 2' : 'e.g. 50'}
                  onChange={(e) => set('penalty_value', e.target.value)} />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Grace period (days)</label>
                <input style={inputStyle} type="number" min="0"
                  value={form.penalty_grace_days} placeholder="e.g. 5"
                  onChange={(e) => set('penalty_grace_days', e.target.value)} />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Cash Opening Balance</div>
            <div style={rowGrid}>
              <div style={fieldWrap}>
                <label style={lbl}>Opening balance (₹)</label>
                <input style={inputStyle} type="number" min="0" step="0.01"
                  value={form.cash_balance} placeholder="e.g. 100000"
                  onChange={(e) => set('cash_balance', e.target.value)} />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>As on date</label>
                <input style={inputStyle} type="date"
                  value={form.cash_balance_as_on}
                  onChange={(e) => set('cash_balance_as_on', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
