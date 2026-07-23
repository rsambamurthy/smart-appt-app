import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
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

/* ── shared field styles ── */
const fl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block',
};
const fc: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, color: '#1e293b',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
};
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px', marginTop: 18 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginTop: 18 };
const hint: React.CSSProperties = { fontSize: 11.5, color: '#94a3b8', marginTop: 5 };

export default function DuesConfigPage() {
  const navigate = useNavigate();
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

  /* ── Card wrapper ── */
  const Card = ({
    icon, iconBg, iconColor, title, subtitle,
    accent, children,
  }: {
    icon: string; iconBg: string; iconColor: string;
    title: string; subtitle: string;
    accent?: string;
    children: React.ReactNode;
  }) => (
    <div style={{
      background: '#fff',
      border: `1px solid ${accent ? accent : '#e2e8f0'}`,
      borderLeft: accent ? `4px solid ${accent}` : '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 4 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 22, color: iconColor }} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{subtitle}</div>
        </div>
        {accent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#dcfce7', color: '#15803d',
            border: '1px solid #86efac',
            borderRadius: 99, padding: '4px 12px',
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>
            <i className="ti ti-circle-check" style={{ fontSize: 14 }} aria-hidden="true" />
            Enabled
          </div>
        )}
      </div>
      {children}
    </div>
  );

  return (
    <Layout>
      <div style={{ padding: '1.5rem 2rem 5rem', maxWidth: 860 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="ti ti-file-invoice" style={{ fontSize: 28, color: '#2563eb' }} aria-hidden="true" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Billing Configuration</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              Configure billing, penalties, auto-generation and cash opening settings.
            </p>
          </div>
        </div>

        {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}
        {success && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#15803d', fontSize: 13 }}>✓ {success}</div>}

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : (
          <>
            {/* ── Monthly Charge ── */}
            <Card
              icon="ti-calendar-stats" iconBg="#eff6ff" iconColor="#2563eb"
              title="Monthly Charge"
              subtitle="Define the fixed amount and due day for monthly billing."
            >
              <div style={grid3}>
                <div>
                  <label style={fl}>Charge type</label>
                  <select style={fc} value={form.charge_type} onChange={e => set('charge_type', e.target.value)}>
                    <option value="FIXED">Fixed amount</option>
                    <option value="RATE_PER_SQFT">Rate per sq ft</option>
                  </select>
                </div>
                <div>
                  {form.charge_type === 'FIXED' ? (
                    <>
                      <label style={fl}>Monthly charge (₹)</label>
                      <input style={fc} type="number" min="0" step="0.01"
                        value={form.monthly_charge} placeholder="e.g. 2500"
                        onChange={e => set('monthly_charge', e.target.value)} />
                    </>
                  ) : (
                    <>
                      <label style={fl}>Rate per sq ft (₹)</label>
                      <input style={fc} type="number" min="0" step="0.01"
                        value={form.rate_per_sqft} placeholder="e.g. 2.50"
                        onChange={e => set('rate_per_sqft', e.target.value)} />
                    </>
                  )}
                </div>
                <div>
                  <label style={fl}>Due day of month</label>
                  <input style={fc} type="number" min="1" max="28"
                    value={form.due_day} placeholder="1–28"
                    onChange={e => set('due_day', e.target.value)} />
                  <div style={hint}>Bills are due on this day each month.</div>
                </div>
              </div>
            </Card>

            {/* ── Penalty ── */}
            <Card
              icon="ti-percentage" iconBg="#f5f3ff" iconColor="#7c3aed"
              title="Penalty"
              subtitle="Set penalty amount and grace period for overdue bills."
            >
              <div style={grid3}>
                <div>
                  <label style={fl}>Penalty type</label>
                  <select style={fc} value={form.penalty_type} onChange={e => set('penalty_type', e.target.value)}>
                    <option value="FLAT">Flat amount</option>
                    <option value="PERCENTAGE">Percentage</option>
                  </select>
                </div>
                <div>
                  <label style={fl}>{form.penalty_type === 'PERCENTAGE' ? 'Penalty %' : 'Penalty amount (₹)'}</label>
                  <input style={fc} type="number" min="0" step="0.01"
                    value={form.penalty_value}
                    placeholder={form.penalty_type === 'PERCENTAGE' ? 'e.g. 2' : 'e.g. 50'}
                    onChange={e => set('penalty_value', e.target.value)} />
                </div>
                <div>
                  <label style={fl}>Grace period (days)</label>
                  <input style={fc} type="number" min="0"
                    value={form.penalty_grace_days} placeholder="e.g. 5"
                    onChange={e => set('penalty_grace_days', e.target.value)} />
                  <div style={hint}>No penalty within these days past due.</div>
                </div>
              </div>
            </Card>

            {/* ── Auto-Generate ── */}
            <Card
              icon="ti-refresh" iconBg="#f0fdf4" iconColor="#16a34a"
              title="Auto-Generate Bills"
              subtitle="Automatically generate bills on a specific day each month."
              accent={form.auto_generate_bills ? '#22c55e' : undefined}
            >
              {/* Toggle row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                {/* Slide toggle */}
                <div style={{ position: 'relative', width: 44, height: 24, flexShrink: 0 }}>
                  <input
                    type="checkbox" id="auto_gen_chk"
                    checked={form.auto_generate_bills}
                    onChange={e => { setForm(f => ({ ...f, auto_generate_bills: e.target.checked })); setError(''); setSuccess(''); }}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <label htmlFor="auto_gen_chk" style={{
                    position: 'absolute', inset: 0,
                    background: form.auto_generate_bills ? '#2563eb' : '#cbd5e1',
                    borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
                    display: 'block',
                  }}>
                    <span style={{
                      position: 'absolute',
                      width: 18, height: 18,
                      left: form.auto_generate_bills ? 23 : 3, top: 3,
                      background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </label>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Automatically create bills each month</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Bills will be generated on the configured day without any manual action.
                  </div>
                </div>
              </div>

              {form.auto_generate_bills && (
                <div style={{ marginTop: 18, maxWidth: 260 }}>
                  <label style={fl}>Generate on day of month</label>
                  <input style={fc} type="number" min="1" max="28"
                    value={form.auto_generate_day} placeholder="1–28"
                    onChange={e => set('auto_generate_day', e.target.value)} />
                  <div style={hint}>Must be between 1 and 28.</div>
                </div>
              )}
            </Card>

            {/* ── Cash Opening Balance ── */}
            <Card
              icon="ti-wallet" iconBg="#eff6ff" iconColor="#2563eb"
              title="Cash Opening Balance"
              subtitle="Set the opening balance and effective date."
            >
              <div style={grid2}>
                <div>
                  <label style={fl}>Opening balance (₹)</label>
                  <input style={fc} type="number" min="0" step="0.01"
                    value={form.cash_balance} placeholder="e.g. 100000"
                    onChange={e => set('cash_balance', e.target.value)} />
                </div>
                <div>
                  <label style={fl}>As on date</label>
                  <input style={fc} type="date"
                    value={form.cash_balance_as_on}
                    onChange={e => set('cash_balance_as_on', e.target.value)} />
                </div>
              </div>
            </Card>

            {/* ── Footer actions ── */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              paddingTop: 8, marginTop: 4,
            }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 22px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 22px', borderRadius: 8,
                  border: 'none', background: '#2563eb',
                  color: '#fff', fontSize: 14, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                <i className="ti ti-device-floppy" style={{ fontSize: 15 }} aria-hidden="true" />
                {isSaving ? 'Saving…' : 'Save Configuration'}
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
