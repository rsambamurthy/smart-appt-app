import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useRequestOtpMutation, useVerifyOtpMutation } from '../store/api/authApi';
import { setCredentials } from '../features/auth/authSlice';
import { baseApi } from '../store/api/baseApi';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [waStatus, setWaStatus] = useState<{ sent: boolean; error?: string } | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [requestOtp, { isLoading: sending }] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDevOtp(null);
    try {
      const result = await requestOtp({ phone }).unwrap();
      if (result?.data?.wa_status) {
        setWaStatus(result.data.wa_status as { sent: boolean; error?: string });
      }
      if (result?.data?.dev_otp) {
        setDevOtp(result.data.dev_otp as string);
      }
      setStep('otp');
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string }; error?: string })?.data?.detail
        ?? (err as { error?: string })?.error
        ?? JSON.stringify(err)
        ?? 'Failed to send OTP. Check that the backend is running.';
      setError(msg);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await verifyOtp({ phone, otp }).unwrap();
      // Clear ALL cached API data from the previous session before storing new credentials
      dispatch(baseApi.util.resetApiState());
      dispatch(setCredentials(result.data as never));
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string }; error?: string })?.data?.detail
        ?? (err as { error?: string })?.error
        ?? JSON.stringify(err)
        ?? 'Invalid OTP. Please try again.';
      setError(msg);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>SmartAppt</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: 4 }}>Apartment Association Management</p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={sending}>
              {sending ? 'Sending OTP...' : 'Send OTP'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link to="/register" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                Register Association
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>OTP sent via WhatsApp to {phone}</p>
            {waStatus && (
              <div style={{ background: waStatus.sent ? '#f0fdf4' : '#fef2f2', border: `1px solid ${waStatus.sent ? '#86efac' : '#fca5a5'}`, borderRadius: 6, padding: '0.4rem 0.9rem', marginBottom: '0.5rem', fontSize: '0.78rem', color: waStatus.sent ? '#166534' : '#dc2626' }}>
                WhatsApp: {waStatus.sent ? '✓ Sent' : `✗ ${waStatus.error ?? 'Failed'}`}
              </div>
            )}
            {devOtp && (
              <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 6, padding: '0.4rem 0.9rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#854d0e' }}>
                DEV — OTP: <strong>{devOtp}</strong>
              </div>
            )}
            <div className="form-group">
              <label>Enter OTP</label>
              <input type="text" inputMode="numeric" maxLength={8} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} required autoFocus />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={verifying}>
              {verifying ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => { setStep('phone'); setWaStatus(null); setDevOtp(null); }}>
              Change Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
