import { useEffect, useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetAssociationConfigQuery, useUpdateAssociationConfigMutation,
} from '../../store/api/associationConfigApi';

const labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 } as const;
const inputStyle = { width: '100%', maxWidth: 260, padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' } as const;
const pageBtn = { padding: '8px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;

/**
 * A single setting: how much an expense has to be before it needs
 * Treasurer → Committee (→ Manager, if over ₹50,000 in the BPM workflow)
 * sign-off rather than being recorded straight away.
 *
 * This used to have no screen at all — the column existed
 * (association_config.expense_approval_threshold) but the only way to set it
 * was a hardcoded value in the seed script, so every real association got 0,
 * meaning approval was silently off for all of them. See admin.schema.ts on
 * the backend for the other half of this fix (the endpoint used to crash on
 * a partial update).
 */
export default function ExpenseApprovalSettingsPage() {
  const { data, isLoading, error } = useGetAssociationConfigQuery();
  const [update, { isLoading: saving }] = useUpdateAssociationConfigMutation();

  const [threshold, setThreshold] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.data) {
      setThreshold(String(Number(data.data.expense_approval_threshold)));
      setDirty(false);
    }
  }, [data]);

  const parsed = Number(threshold);
  const isValid = threshold.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

  const onChange = (v: string) => {
    setThreshold(v);
    setDirty(true);
    setSaved(false);
  };

  const onSave = async () => {
    if (!isValid) return;
    setSaveError(null);
    try {
      await update({ expense_approval_threshold: parsed }).unwrap();
      setDirty(false);
      setSaved(true);
    } catch (err) {
      const msg = (err as { data?: { message?: string; detail?: string } })?.data?.message
        ?? (err as { data?: { detail?: string } })?.data?.detail
        ?? 'Could not save — please try again.';
      setSaveError(msg);
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Configuration' }, { label: 'Expenses Threshold' }]} />

      <div style={{ padding: '1.5rem 2rem', maxWidth: 640 }}>
        <div style={{ padding: '0.7rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.85rem', color: '#1d4ed8', marginBottom: '1.25rem' }}>
          Any expense over this amount is created as <b>Pending Approval</b> instead of being
          recorded straight away, and needs Treasurer then Committee sign-off (and Manager too,
          if it's routed through the approval workflow tool for high-value items) before it's final.
        </div>

        {error ? (
          <div style={{ border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#b91c1c' }}>Could not load this setting.</div>
            <div style={{ fontSize: 12.5, color: '#7f1d1d', marginTop: 4 }}>
              {'status' in error && error.status === 403
                ? 'You are not permitted to configure this association.'
                : `Request failed${'status' in error ? ` (${String(error.status)})` : ''}.`}
            </div>
          </div>
        ) : isLoading ? (
          <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.1rem 1.25rem', background: '#fff' }}>
            <label style={labelStyle}>Expense approval threshold (₹)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={0}
                step="0.01"
                style={inputStyle}
                value={threshold}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0"
              />
              <button onClick={onSave} disabled={!dirty || !isValid || saving} style={{
                ...pageBtn,
                background: dirty && isValid ? '#2563eb' : '#e2e8f0',
                color: dirty && isValid ? '#fff' : '#94a3b8',
              }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {!isValid && threshold.trim() !== '' && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>Enter an amount of 0 or more.</div>
            )}
            {saveError && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: '#dc2626' }}>{saveError}</div>
            )}
            {saved && !dirty && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: '#16a34a', fontWeight: 600 }}>Saved.</div>
            )}

            <div style={{ marginTop: 14, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {parsed === 0
                ? 'Currently 0 — approval is off. Every new expense is recorded immediately, regardless of amount.'
                : `Currently ₹${parsed.toLocaleString('en-IN')} — an expense is only sent for approval if its amount is strictly greater than this.`}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
