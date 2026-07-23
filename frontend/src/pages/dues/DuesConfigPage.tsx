import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetDuesConfigQuery, useUpdateDuesConfigMutation } from '../../store/api/duesApi';

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
  auto_generate_bills: boolean;
  auto_generate_day: string;
}

const EMPTY: ConfigForm = {
  charge_type: 'FIXED', monthly_charge: '', rate_per_sqft: '', due_day: '5',
  penalty_type: 'FLAT', penalty_value: '', penalty_grace_days: '5',
  cash_balance: '', cash_balance_as_on: '',
  auto_generate_bills: false, auto_generate_day: '1',
};

const s: Record<string, React.CSSProperties> = {
  wrap:      { padding: '1.25rem 1.5rem 2rem', maxWidth: 860 },
  section:   { border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: 'var(--color-bg-card)' },
  secHdr:    { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' },
  secIcon:   { width: 28, height: 28, borderRadius: 6, background: 'var(--theme-accent-light)', color: 'var(--theme-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 },
  secTitle:  { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--theme-accent)' },
  secBody:   { padding: '14px 16px' },
  grid3:     { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px' },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' },
  fg:        { display: 'flex', flexDirection: 'column', gap: 4 },
  fl:        { fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  fc:        { padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'var(--color-text)', background: 'var(--color-bg-card)', width: '100%', boxSizing: 'border-box' as const, outline: 'none' },
  fcHint:    { fontSize: 11, color: 'var(--color-muted)', marginTop: 2 },
  badge:     { marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 },
  badgeDot:  { width: 5, height: 5, borderRadius: '50%' },
  toggleRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  tLabel:    { fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' },
  tHint:     { fontSize: 11.5, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.5 },
  infoStrip: { fontSize: 11.5, color: 'var(--color-muted)', borderLeft: '2.5px solid var(--theme-accent)', padding: '7px 12px', borderRadius: '0 6px 6px 0', background: 'var(--color-bg)', marginTop: 12 },
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
      auto_generate_bills: cfg.auto_generate_bills === true,
      auto_generate_day: cfg.auto_generate_day != null ? String(cfg.auto_generate_day) : '1',
    });
  }, [data]);

  const set = (k: keyof ConfigForm, v: string) => { setForm(f => ({ ...f, [k]: v })); setError(''); setSuccess(''); };

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
        auto_generate_bills: form.auto_generate_bills,
        auto_generate_day: parseInt(form.auto_generate_day, 10) || 1,
      }).unwrap();
      setSuccess('Fee configuration saved.');
    } catch (e: unknown) {
      const err = e as { data?: { message?: string; detail?: string } };
      setError(err?.data?.message ?? err?.data?.detail ?? 'Failed to save.');
    }
  };

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div style={s.fg}>
      <label style={s.fl}>{label}</label>
      {children}
      {hint && <span style={s.fcHint}>{hint}</span>}
    </div>
  );

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'Configuration' }, { label: 'Fee Configuration' }]}
        onSave={handleSave} saveLabel="Save configuration" saving={isSaving}
      />

      {isLoading ? (
        <div style={{ padding: '2rem', color: 'var(--color-muted)' }}>Loading…</div>
      ) : (
        <div style={s.wrap}>

          {error && <div style={{ marginBottom: 12, padding: '0.65rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>{error}</div>}
          {success && <div style={{ marginBottom: 12, padding: '0.65rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontSize: 13 }}>✓ {success}</div>}

          {/* ── Monthly Charge ── */}
          <div style={s.section}>
            <div style={s.secHdr}>
              <div style={s.secIcon}><i className="ti ti-receipt" aria-hidden="true" /></div>
              <span style={s.secTitle}>Monthly charge</span>
            </div>
            <div style={s.secBody}>
              <div style={s.grid3}>
                <Field label="Charge type">
                  <select style={s.fc} value={form.charge_type} onChange={e => set('charge_type', e.target.value)}>
                    <option value="FIXED">Fixed amount</option>
                    <option value="RATE_PER_SQFT">Rate per sq ft</option>
                  </select>
                </Field>
                {form.charge_type === 'FIXED' ? (
                  <Field label="Monthly charge (₹)">
                    <input style={s.fc} type="number" min="0" step="0.01"
                      value={form.monthly_charge} placeholder="e.g. 2500"
                      onChange={e => set('monthly_charge', e.target.value)} />
                  </Field>
                ) : (
                  <Field label="Rate per sq ft (₹)">
                    <input style={s.fc} type="number" min="0" step="0.01"
                      value={form.rate_per_sqft} placeholder="e.g. 2.50"
                      onChange={e => set('rate_per_sqft', e.target.value)} />
                  </Field>
                )}
                <Field label="Due day of month" hint="Bills are due on this day each month">
                  <input style={s.fc} type="number" min="1" max="28"
                    value={form.due_day} placeholder="1–28"
                    onChange={e => set('due_day', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Penalty ── */}
          <div style={s.section}>
            <div style={s.secHdr}>
              <div style={s.secIcon}><i className="ti ti-alert-triangle" aria-hidden="true" /></div>
              <span style={s.secTitle}>Penalty</span>
            </div>
            <div style={s.secBody}>
              <div style={s.grid3}>
                <Field label="Penalty type">
                  <select style={s.fc} value={form.penalty_type} onChange={e => set('penalty_type', e.target.value)}>
                    <option value="FLAT">Flat amount</option>
                    <option value="PERCENTAGE">Percentage</option>
                  </select>
                </Field>
                <Field label={form.penalty_type === 'PERCENTAGE' ? 'Penalty %' : 'Penalty amount (₹)'}>
                  <input style={s.fc} type="number" min="0" step="0.01"
                    value={form.penalty_value}
                    placeholder={form.penalty_type === 'PERCENTAGE' ? 'e.g. 2' : 'e.g. 50'}
                    onChange={e => set('penalty_value', e.target.value)} />
                </Field>
                <Field label="Grace period (days)" hint="No penalty within these days past due">
                  <input style={s.fc} type="number" min="0"
                    value={form.penalty_grace_days} placeholder="e.g. 5"
                    onChange={e => set('penalty_grace_days', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Auto-generate ── */}
          <div style={s.section}>
            <div style={s.secHdr}>
              <div style={s.secIcon}><i className="ti ti-calendar-event" aria-hidden="true" /></div>
              <span style={s.secTitle}>Auto-generate bills</span>
              <div style={{
                ...s.badge,
                background: form.auto_generate_bills ? '#dcfce7' : '#f1f5f9',
                color: form.auto_generate_bills ? '#15803d' : '#64748b',
              }}>
                <span style={{ ...s.badgeDot, background: form.auto_generate_bills ? '#22c55e' : '#94a3b8' }} />
                {form.auto_generate_bills ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div style={s.secBody}>
              <div style={s.toggleRow}>
                {/* Slide toggle */}
                <div style={{ position: 'relative', width: 36, height: 20, flexShrink: 0, marginTop: 2 }}>
                  <input
                    type="checkbox"
                    id="auto_gen_chk"
                    checked={form.auto_generate_bills}
                    onChange={e => { setForm(f => ({ ...f, auto_generate_bills: e.target.checked })); setError(''); setSuccess(''); }}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <label htmlFor="auto_gen_chk" style={{
                    position: 'absolute', inset: 0,
                    background: form.auto_generate_bills ? 'var(--theme-accent)' : '#d1d5db',
                    borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
                  }}>
                    <span style={{
                      position: 'absolute',
                      width: 16, height: 16,
                      left: form.auto_generate_bills ? 18 : 2, top: 2,
                      background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
                    }} />
                  </label>
                </div>
                <div>
                  <div style={s.tLabel}>Automatically create bills each month</div>
                  <div style={s.tHint}>Bills will be generated on the configured day without any manual action.</div>
                </div>
              </div>

              {form.auto_generate_bills && (
                <div style={{ marginTop: 14, maxWidth: 220 }}>
                  <Field label="Generate on day of month" hint="Must be between 1 and 28">
                    <input style={s.fc} type="number" min="1" max="28"
                      value={form.auto_generate_day} placeholder="1–28"
                      onChange={e => set('auto_generate_day', e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </div>

          {/* ── Cash Opening Balance ── */}
          <div style={s.section}>
            <div style={s.secHdr}>
              <div style={s.secIcon}><i className="ti ti-building-bank" aria-hidden="true" /></div>
              <span style={s.secTitle}>Cash opening balance</span>
            </div>
            <div style={s.secBody}>
              <div style={s.grid2}>
                <Field label="Opening balance (₹)">
                  <input style={s.fc} type="number" min="0" step="0.01"
                    value={form.cash_balance} placeholder="e.g. 100000"
                    onChange={e => set('cash_balance', e.target.value)} />
                </Field>
                <Field label="As on date">
                  <input style={s.fc} type="date"
                    value={form.cash_balance_as_on}
                    onChange={e => set('cash_balance_as_on', e.target.value)} />
                </Field>
              </div>
              <div style={s.infoStrip}>
                One-time entry used as the starting point for cash flow reports.
              </div>
            </div>
          </div>

        </div>
      )}
    </Layout>
  );
}
