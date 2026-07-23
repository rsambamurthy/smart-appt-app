import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useGetRazorpayConfigQuery, useSaveRazorpayConfigMutation } from '../../store/api/duesApi';

export default function RazorpayConfigPage() {
  const { data, isLoading } = useGetRazorpayConfigQuery();
  const [save, { isLoading: saving }] = useSaveRazorpayConfigMutation();

  const [keyId, setKeyId]         = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [success, setSuccess]     = useState('');
  const [error, setError]         = useState('');

  useEffect(() => {
    if (data?.data?.razorpay_key_id) setKeyId(data.data.razorpay_key_id);
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(''); setError('');
    if (!keyId.trim() || !keySecret.trim()) { setError('Both Key ID and Key Secret are required.'); return; }
    try {
      await save({ razorpay_key_id: keyId.trim(), razorpay_key_secret: keySecret.trim() }).unwrap();
      setSuccess('Razorpay credentials saved. Residents can now pay online directly to your association account.');
      setKeySecret('');
    } catch (err: unknown) {
      setError((err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to save configuration.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.9rem',
    border: '1px solid var(--color-border)', borderRadius: 8,
    fontSize: '0.95rem', outline: 'none', background: 'var(--color-bg-card)',
    color: 'var(--color-text)', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 600, fontSize: '0.8rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--color-muted)', marginBottom: 6,
  };

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'Configuration' }, { label: 'Razorpay' }]}
        onSave={handleSave}
        saveLabel="Save Credentials"
        saving={saving}
      />

      <div style={{ padding: '1.5rem 2rem', maxWidth: 560 }}>

        {/* Info banner */}
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
          padding: '1rem 1.25rem', marginBottom: '1.75rem',
        }}>
          <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>How this works</div>
          <div style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: 1.7 }}>
            Create a free Razorpay account at <strong>razorpay.com</strong> and link your association's bank account there.
            Then paste your API credentials below. Resident payments will go <strong>directly into your association's bank account</strong> — SmartAppt never holds the funds.
          </div>
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="card" style={{ padding: '1.5rem' }}>

              {/* Status indicator */}
              {data?.data && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.6rem 0.9rem', borderRadius: 8, marginBottom: '1.5rem',
                  background: data.data.razorpay_key_id && data.data.has_key_secret ? '#f0fdf4' : '#fef9c3',
                  border: `1px solid ${data.data.razorpay_key_id && data.data.has_key_secret ? '#86efac' : '#fde047'}`,
                }}>
                  <span style={{ fontSize: '1.1rem' }}>
                    {data.data.razorpay_key_id && data.data.has_key_secret ? '✅' : '⚠️'}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600,
                    color: data.data.razorpay_key_id && data.data.has_key_secret ? '#15803d' : '#854d0e' }}>
                    {data.data.razorpay_key_id && data.data.has_key_secret
                      ? 'Razorpay is configured — online payments are active.'
                      : 'Razorpay not yet configured — online payments are disabled.'}
                  </span>
                </div>
              )}

              {/* Key ID */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Razorpay Key ID</label>
                <input
                  type="text"
                  placeholder="rzp_live_xxxxxxxxxxxx"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  style={inputStyle}
                  autoComplete="off"
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 5 }}>
                  Found in Razorpay Dashboard → Settings → API Keys
                </div>
              </div>

              {/* Key Secret */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={labelStyle}>
                  Razorpay Key Secret
                  {data?.data?.has_key_secret && (
                    <span style={{ marginLeft: 8, fontWeight: 400, color: '#16a34a', textTransform: 'none', fontSize: '0.75rem' }}>
                      ✓ Already saved — enter a new value to update
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={data?.data?.has_key_secret ? '••••••••••••••••••••' : 'Your secret key'}
                    value={keySecret}
                    onChange={(e) => setKeySecret(e.target.value)}
                    style={{ ...inputStyle, paddingRight: '3rem' }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.85rem', color: 'var(--color-muted)',
                    }}
                  >
                    {showSecret ? '🙈' : '👁'}
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 5 }}>
                  The secret is never displayed after saving — it is stored securely on the server.
                </div>
              </div>

            </div>

            {error && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#15803d', fontSize: '0.875rem' }}>
                ✓ {success}
              </div>
            )}

            {/* Steps guide */}
            <div style={{ marginTop: '1.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: '0.75rem' }}>
                How to get your API keys from Razorpay
              </div>
              {[
                'Go to razorpay.com → Create a free account',
                'Complete KYC and link your association\'s bank account',
                'Go to Settings → API Keys → Generate Key',
                'Copy the Key ID and Key Secret and paste above',
                'Switch from Test mode to Live mode before going live',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</div>
                  <span>{step}</span>
                </div>
              ))}
            </div>

          </form>
        )}
      </div>
    </Layout>
  );
}
