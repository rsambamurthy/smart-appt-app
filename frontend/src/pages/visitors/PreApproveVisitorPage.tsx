import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import { usePreApproveVisitorMutation } from '../../store/api/visitorsApi';

/**
 * A datetime-local input will only display a value shaped exactly
 * 'YYYY-MM-DDTHH:mm'. Hand it anything else — an ISO string with seconds and a
 * Z, for instance — and it silently renders blank rather than complaining.
 *
 * So the picked value is held verbatim in state and converted to ISO once, on
 * submit. Converting on every keystroke is what emptied the field before, and
 * an empty required field is why the QR code never generated.
 */
export default function PreApproveVisitorPage() {
  const navigate = useNavigate();
  const [preApprove, { isLoading }] = usePreApproveVisitorMutation();
  const [form, setForm] = useState({ name: '', phone: '', expected_at: '', purpose: '', vehicle_number: '' });
  const [result, setResult] = useState<{ qr_token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local time, as the browser would render it — used as the earliest arrival
  // the picker will accept. Pre-approving a visit in the past is always a slip.
  const nowLocal = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 'YYYY-MM-DDTHH:mm' is parsed as local time, which is what the resident
    // meant. The server stores UTC.
    const when = new Date(form.expected_at);
    if (Number.isNaN(when.getTime())) {
      setError('Choose when the visitor is expected.');
      return;
    }

    try {
      const res = await preApprove({ ...form, expected_at: when.toISOString() }).unwrap();
      setResult(res.data);
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string; message?: string } };
      setError(e2?.data?.detail ?? e2?.data?.message ?? 'Could not pre-approve this visitor.');
    }
  };

  if (result) return (
    <Layout>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Visitor Pre-Approved</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Share this QR token with your visitor:</p>
        <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius)', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '2px', marginBottom: '1rem' }}>{result.qr_token}</div>
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Done</button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="page-header"><h1>Pre-approve Visitor</h1></div>
      <div className="card" style={{ maxWidth: 500 }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              marginBottom: 14, padding: '11px 14px', borderRadius: 9, fontSize: 13.5,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            }}>
              {error}
            </div>
          )}

          {(['name', 'phone', 'purpose', 'vehicle_number'] as const).map((field) => (
            <div className="form-group" key={field}>
              <label>{field.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}{field === 'name' ? ' *' : ''}</label>
              <input type={field === 'phone' ? 'tel' : 'text'} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required={field === 'name'} />
            </div>
          ))}
          <div className="form-group">
            <label>Expected Arrival *</label>
            <input
              type="datetime-local"
              value={form.expected_at}
              min={nowLocal}
              onChange={(e) => setForm({ ...form, expected_at: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate QR'}</button>
        </form>
      </div>
    </Layout>
  );
}
