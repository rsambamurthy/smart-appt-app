import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import { usePreApproveVisitorMutation } from '../../store/api/visitorsApi';

export default function PreApproveVisitorPage() {
  const navigate = useNavigate();
  const [preApprove, { isLoading }] = usePreApproveVisitorMutation();
  const [form, setForm] = useState({ name: '', phone: '', expected_at: '', purpose: '', vehicle_number: '' });
  const [result, setResult] = useState<{ qr_token: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await preApprove(form).unwrap();
    setResult(res.data);
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
          {(['name', 'phone', 'purpose', 'vehicle_number'] as const).map((field) => (
            <div className="form-group" key={field}>
              <label>{field.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}{field === 'name' ? ' *' : ''}</label>
              <input type={field === 'phone' ? 'tel' : 'text'} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required={field === 'name'} />
            </div>
          ))}
          <div className="form-group">
            <label>Expected Arrival *</label>
            <input type="datetime-local" value={form.expected_at} onChange={(e) => setForm({ ...form, expected_at: new Date(e.target.value).toISOString() })} required />
          </div>
          <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate QR'}</button>
        </form>
      </div>
    </Layout>
  );
}
