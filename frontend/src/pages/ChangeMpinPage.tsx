import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChangeMpinMutation } from '../store/api/authApi';
import PageSubHeader from '../components/molecules/PageSubHeader';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '1.1rem', outline: 'none', boxSizing: 'border-box',
  letterSpacing: '0.25em', textAlign: 'center',
};

// Defined OUTSIDE the page component so React never unmounts it on re-render
const PinInput = ({ label, value, onChange, autoFocus = false }: {
  label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean;
}) => (
  <div style={{ marginBottom: '1rem' }}>
    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>{label}</label>
    <input
      type="password"
      inputMode="numeric"
      maxLength={4}
      placeholder="● ● ● ●"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      onBlur={(e) => { if (e.target.value.length < 4) setTimeout(() => e.target.focus(), 10); }}
      style={inputStyle}
      autoFocus={autoFocus}
    />
  </div>
);

export default function ChangeMpinPage() {
  const [currentMpin, setCurrentMpin] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changeMpin, { isLoading }] = useChangeMpinMutation();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newMpin !== confirmMpin) { setError('New PINs do not match.'); return; }
    if (newMpin === currentMpin) { setError('New M-PIN must be different from current.'); return; }
    try {
      await changeMpin({ current_mpin: currentMpin, new_mpin: newMpin }).unwrap();
      setSuccess('M-PIN changed successfully!');
      setCurrentMpin(''); setNewMpin(''); setConfirmMpin('');
      setTimeout(() => navigate(-1), 1500);
    } catch (err: unknown) {
      setError((err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to change M-PIN.');
    }
  };

  return (
    <div>
      <PageSubHeader title="Change M-PIN" subtitle="Update your 4-digit login PIN" />
      <div style={{ maxWidth: 420, margin: '2rem auto', padding: '0 1rem' }}>
        <div className="card">
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#f0fdf4', color: '#166534', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
              {success}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <PinInput label="Current M-PIN" value={currentMpin} onChange={setCurrentMpin} autoFocus />
            <PinInput label="New M-PIN" value={newMpin} onChange={setNewMpin} />
            <PinInput label="Confirm New M-PIN" value={confirmMpin} onChange={setConfirmMpin} />
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={isLoading || currentMpin.length < 4 || newMpin.length < 4 || confirmMpin.length < 4}
            >
              {isLoading ? 'Changing...' : 'Change M-PIN'}
            </button>
            <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => navigate(-1)}>
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
