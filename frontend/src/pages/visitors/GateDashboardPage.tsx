import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Layout from '../../components/organisms/Layout';
import { useLogWalkInMutation, useApproveVisitorMutation, useLookupQrQuery } from '../../store/api/visitorsApi';

export default function GateDashboardPage() {
  const [tab, setTab] = useState<'walkin' | 'qr'>('walkin');
  const [form, setForm] = useState({ visitor_name: '', visitor_phone: '', unit_id: '', purpose: '', vehicle_number: '' });
  const [qrToken, setQrToken] = useState('');
  const [pendingVisitor, setPendingVisitor] = useState<Record<string, unknown> | null>(null);
  const [logWalkIn, { isLoading }] = useLogWalkInMutation();
  const [approveVisitor] = useApproveVisitorMutation();
  const { data: qrData } = useLookupQrQuery(qrToken, { skip: qrToken.length < 10 });

  useEffect(() => {
    const socket = io('/', { auth: { token: sessionStorage.getItem('access_token') } });
    socket.emit('join:gate', 'assoc_id_placeholder');
    socket.on('visitor:walkin', (data: Record<string, unknown>) => setPendingVisitor(data));
    socket.on('visitor:decision', () => setPendingVisitor(null));
    return () => { socket.disconnect(); };
  }, []);

  const handleWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await logWalkIn(form).unwrap();
    setForm({ visitor_name: '', visitor_phone: '', unit_id: '', purpose: '', vehicle_number: '' });
  };

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Gate Dashboard</h1>
        {pendingVisitor && <div className="badge badge-yellow" style={{ animation: 'pulse 1s infinite' }}>⚠ Pending Approval</div>}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className={tab === 'walkin' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('walkin')}>Walk-in</button>
        <button className={tab === 'qr' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('qr')}>Scan QR</button>
      </div>

      {tab === 'walkin' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <form onSubmit={handleWalkIn}>
            {['visitor_name', 'visitor_phone', 'unit_id', 'purpose', 'vehicle_number'].map((f) => (
              <div className="form-group" key={f}>
                <label>{f.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}{f === 'visitor_name' || f === 'unit_id' ? ' *' : ''}</label>
                <input type="text" value={(form as Record<string, string>)[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} required={f === 'visitor_name' || f === 'unit_id'} />
              </div>
            ))}
            <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Logging...' : 'Log Walk-in'}</button>
          </form>
        </div>
      )}

      {tab === 'qr' && (
        <div className="card" style={{ maxWidth: 400 }}>
          <div className="form-group">
            <label>Enter QR Token</label>
            <input type="text" placeholder="Paste or scan QR token" value={qrToken} onChange={(e) => setQrToken(e.target.value)} />
          </div>
          {qrData && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontWeight: 600 }}>{(qrData.data as Record<string, string>)?.visitor_name}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>Status: {(qrData.data as Record<string, string>)?.status}</div>
              <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => approveVisitor({ id: (qrData.data as Record<string, string>).id, decision: 'APPROVED' })}>Allow Entry</button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
