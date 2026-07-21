import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import { useCreateTicketMutation } from '../../store/api/maintenanceApi';

const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'CIVIL', 'HOUSEKEEPING', 'COMMON_AREA', 'OTHERS'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

export default function RaiseTicketPage() {
  const navigate = useNavigate();
  const [createTicket, { isLoading }] = useCreateTicketMutation();
  const [form, setForm] = useState({ category: 'PLUMBING', priority: 'MEDIUM', title: '', description: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      files.forEach((f) => fd.append('files', f));
      await createTicket(fd).unwrap();
      navigate('/maintenance');
    } catch (err) {
      setError((err as { data?: { detail?: string } }).data?.detail ?? 'Failed to submit ticket');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Raise Maintenance Request</h1>
      </div>
      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Title</label>
            <input type="text" placeholder="Brief description" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={255} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={4} placeholder="Describe the issue in detail..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label>Attach Photos / Videos (up to 3)</label>
            <input type="file" accept="image/*,video/mp4" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
            {files.length > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>{files.map((f) => f.name).join(', ')}</div>}
          </div>
          {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Submitting...' : 'Submit Request'}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
