import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRegisterAssociationMutation } from '../store/api/associationsApi';

interface Form {
  name: string; address: string; city: string; state: string; pincode: string;
  admin_name: string; admin_phone: string;
}

const empty = (): Form => ({ name: '', address: '', city: '', state: '', pincode: '', admin_name: '', admin_phone: '' });

export default function RegisterAssociationPage() {
  const [form, setForm] = useState<Form>(empty());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [registerAssociation, { isLoading }] = useRegisterAssociationMutation();
  const navigate = useNavigate();

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const [registeredPhone, setRegisteredPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await registerAssociation(form).unwrap();
      const d = (res as { data?: { admin_phone?: string } }).data;
      setRegisteredPhone(d?.admin_phone ?? form.admin_phone);
      setSuccess('Registration successful!');
      setTimeout(() => navigate('/login'), 5000);
    } catch (err: unknown) {
      console.error('[Register] raw error:', JSON.stringify(err));
      const e = err as { data?: { title?: string; detail?: string; message?: string }; status?: number; error?: string };
      setError(e?.data?.title ?? e?.data?.detail ?? e?.data?.message ?? e?.error ?? (`Error ${e?.status ?? ''}`.trim() || 'Registration failed. Please try again.'));
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '2rem 1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 560 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-primary)', marginBottom: 4 }}>SmartAppt</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)' }}>Register Association</div>
          <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: 4 }}>Set up your apartment association to get started</div>
        </div>

        {success ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
            <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Association Registered!</div>
            <div style={{ background: '#fff', border: '1px solid #86efac', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '0.75rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Your Login Details</div>
              <div style={{ fontSize: '0.9rem', color: '#166534', fontWeight: 700 }}>📱 {registeredPhone}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>Use this phone number to log in. You will receive a one-time password (OTP) via WhatsApp.</div>
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>Redirecting to login in 5 seconds…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>
            )}

            {/* Association Details */}
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Association Details</div>
              <div className="form-group">
                <label>Association Name *</label>
                <input type="text" placeholder="e.g. Sunrise Apartments Owners Association" value={form.name} onChange={set('name')} required />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input type="text" placeholder="Street address" value={form.address} onChange={set('address')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>City</label>
                  <input type="text" placeholder="City" value={form.city} onChange={set('city')} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>State</label>
                  <input type="text" placeholder="State" value={form.state} onChange={set('state')} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Pincode</label>
                  <input type="text" placeholder="600001" value={form.pincode} onChange={set('pincode')} maxLength={10} />
                </div>
              </div>
            </div>

            {/* Admin Details */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Association Manager</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Full Name *</label>
                  <input type="text" placeholder="Manager's full name" value={form.admin_name} onChange={set('admin_name')} required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Phone Number *</label>
                  <input type="tel" placeholder="+91 98765 43210" value={form.admin_phone} onChange={set('admin_phone')} required />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                This phone number will be used to log in. You will receive OTP via WhatsApp.
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
              {isLoading ? 'Registering…' : 'Register Association'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
              Already registered?{' '}
              <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
