import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  useRequestOtpMutation, useVerifyOtpMutation,
  useVerifyMpinMutation, useSetMpinMutation, useResetMpinMutation,
} from '../store/api/authApi';
import { setCredentials } from '../features/auth/authSlice';
import { baseApi } from '../store/api/baseApi';
import { API_BASE } from '../store/api/baseApi';

type Step =
  | 'phone'        // enter phone
  | 'mpin'         // enter M-PIN (has_mpin = true)
  | 'otp'          // enter OTP (no M-PIN or forgot)
  | 'set_mpin'     // set M-PIN after first OTP login
  | 'reset_mpin';  // set new M-PIN after forgot OTP

const card: React.CSSProperties = {
  width: '100%', maxWidth: 400, background: 'white',
  borderRadius: 12, padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
  letterSpacing: '0.15em', textAlign: 'center',
};

const btn = (primary = true): React.CSSProperties => ({
  width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none',
  background: primary ? 'var(--color-primary, #1e3a5f)' : '#f3f4f6',
  color: primary ? 'white' : '#374151', fontWeight: 600, fontSize: '0.95rem',
  cursor: 'pointer', marginTop: '0.5rem',
});

const errBox: React.CSSProperties = {
  background: '#fee2e2', color: '#991b1b', padding: '0.75rem',
  borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem',
};

const infoBox = (color: 'yellow' | 'green' | 'red'): React.CSSProperties => {
  const map = {
    yellow: { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    green:  { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    red:    { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  }[color];
  return {
    background: map.bg, border: `1px solid ${map.border}`, borderRadius: 6,
    padding: '0.5rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: map.text,
  };
};

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [mpin, setMpin] = useState('');
  const [otp, setOtp] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<{ sent: boolean; error?: string } | null>(null);
  // tokens from OTP verify (needed before M-PIN is set)
  const [pendingTokens, setPendingTokens] = useState<{ access_token: string; refresh_token: string; user: object } | null>(null);

  const [requestOtp, { isLoading: sendingOtp }] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: verifyingOtp }] = useVerifyOtpMutation();
  const [verifyMpin, { isLoading: verifyingMpin }] = useVerifyMpinMutation();
  const [setMpinMutation, { isLoading: settingMpin }] = useSetMpinMutation();
  const [resetMpin, { isLoading: resettingMpin }] = useResetMpinMutation();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const clearErr = () => setError('');

  // ── Step 1: phone submitted ───────────────────────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    try {
      const res = await fetch(`${API_BASE}/auth/mpin/status?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json?.data?.has_mpin) {
        setStep('mpin');
      } else {
        await sendOtp();
        setStep('otp');
      }
    } catch {
      setError('Failed to connect to server.');
    }
  };

  // ── Send OTP helper ───────────────────────────────────────────────────────
  const sendOtp = async () => {
    const result = await requestOtp({ phone }).unwrap();
    if (result?.data?.wa_status) setWaStatus(result.data.wa_status as { sent: boolean; error?: string });
    if (result?.data?.dev_otp) setDevOtp(result.data.dev_otp as string);
  };

  // ── M-PIN login ───────────────────────────────────────────────────────────
  const handleMpinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    try {
      const result = await verifyMpin({ phone, mpin }).unwrap();
      loginSuccess(result.data as never);
    } catch (err: unknown) {
      setError(extractError(err, 'Incorrect M-PIN.'));
      setMpin('');
    }
  };

  // ── Forgot M-PIN → send OTP ───────────────────────────────────────────────
  const handleForgotMpin = async () => {
    clearErr();
    setDevOtp(null);
    setWaStatus(null);
    try {
      await sendOtp();
      setStep('reset_mpin');
    } catch (err: unknown) {
      setError(extractError(err, 'Failed to send OTP.'));
    }
  };

  // ── OTP verify (first login) ──────────────────────────────────────────────
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    try {
      const result = await verifyOtp({ phone, otp }).unwrap();
      const tokens = result.data as { access_token: string; refresh_token: string; user: object };
      setPendingTokens(tokens);
      setOtp('');
      setStep('set_mpin');
    } catch (err: unknown) {
      setError(extractError(err, 'Invalid OTP.'));
    }
  };

  // ── Set M-PIN (after first OTP login) ────────────────────────────────────
  const handleSetMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    if (newMpin !== confirmMpin) { setError('PINs do not match.'); return; }
    try {
      // Store credentials first so the set-mpin call is authenticated
      dispatch(baseApi.util.resetApiState());
      dispatch(setCredentials(pendingTokens as never));
      await setMpinMutation({ mpin: newMpin }).unwrap();
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(extractError(err, 'Failed to set M-PIN.'));
    }
  };

  // ── Reset M-PIN (forgot flow) ─────────────────────────────────────────────
  const handleResetMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    if (newMpin !== confirmMpin) { setError('PINs do not match.'); return; }
    try {
      await resetMpin({ phone, otp, new_mpin: newMpin }).unwrap();
      // After reset, log in with M-PIN immediately
      const result = await verifyMpin({ phone, mpin: newMpin }).unwrap();
      loginSuccess(result.data as never);
    } catch (err: unknown) {
      setError(extractError(err, 'Reset failed.'));
    }
  };

  const loginSuccess = (tokens: { access_token: string; refresh_token: string; user: object }) => {
    dispatch(baseApi.util.resetApiState());
    dispatch(setCredentials(tokens as never));
    navigate('/dashboard');
  };

  const extractError = (err: unknown, fallback: string) =>
    (err as { data?: { detail?: string } })?.data?.detail ?? fallback;

  // ── PIN input (4-digit grid) ──────────────────────────────────────────────
  const PinInput = ({ value, onChange, placeholder = '● ● ● ●' }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
      type="password"
      inputMode="numeric"
      maxLength={4}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      style={inputStyle}
      autoFocus
    />
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg, #f1f5f9)' }}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary, #1e3a5f)' }}>SmartAppt</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>Apartment Association Management</p>
        </div>

        {error && <div style={errBox}>{error}</div>}

        {/* ── Step: Phone ── */}
        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>Phone Number</label>
              <input type="tel" placeholder="+91 98765 43210" value={phone}
                onChange={(e) => setPhone(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            <button type="submit" style={btn()} disabled={sendingOtp}>
              {sendingOtp ? 'Checking...' : 'Continue'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link to="/register" style={{ fontSize: '0.875rem', color: 'var(--color-primary, #1e3a5f)', fontWeight: 600 }}>
                Register Association
              </Link>
            </div>
          </form>
        )}

        {/* ── Step: M-PIN login ── */}
        {step === 'mpin' && (
          <form onSubmit={handleMpinLogin}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>Enter your 4-digit M-PIN for {phone}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>M-PIN</label>
              <PinInput value={mpin} onChange={setMpin} />
            </div>
            <button type="submit" style={btn()} disabled={verifyingMpin || mpin.length < 4}>
              {verifyingMpin ? 'Verifying...' : 'Login'}
            </button>
            <button type="button" style={btn(false)} onClick={handleForgotMpin} disabled={sendingOtp}>
              {sendingOtp ? 'Sending OTP...' : 'Forgot M-PIN'}
            </button>
            <button type="button" style={{ ...btn(false), marginTop: 4 }} onClick={() => { setMpin(''); setStep('phone'); }}>
              Change Number
            </button>
          </form>
        )}

        {/* ── Step: OTP (first login) ── */}
        {step === 'otp' && (
          <form onSubmit={handleOtpVerify}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>OTP sent via WhatsApp to {phone}</p>
            {waStatus && (
              <div style={infoBox(waStatus.sent ? 'green' : 'red')}>
                WhatsApp: {waStatus.sent ? '✓ Sent' : `✗ ${waStatus.error ?? 'Failed'}`}
              </div>
            )}
            {devOtp && (
              <div style={infoBox('yellow')}>
                OTP: <strong>{devOtp}</strong>
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>Enter OTP</label>
              <input type="text" inputMode="numeric" maxLength={8} placeholder="123456"
                value={otp} onChange={(e) => setOtp(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            <button type="submit" style={btn()} disabled={verifyingOtp}>
              {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" style={btn(false)} onClick={() => { setOtp(''); setStep('phone'); setWaStatus(null); setDevOtp(null); }}>
              Change Number
            </button>
          </form>
        )}

        {/* ── Step: Set M-PIN (first time) ── */}
        {step === 'set_mpin' && (
          <form onSubmit={handleSetMpin}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Set a 4-digit M-PIN for faster logins next time.
            </p>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>New M-PIN</label>
              <PinInput value={newMpin} onChange={setNewMpin} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>Confirm M-PIN</label>
              <PinInput value={confirmMpin} onChange={setConfirmMpin} placeholder="● ● ● ●" />
            </div>
            <button type="submit" style={btn()} disabled={settingMpin || newMpin.length < 4 || confirmMpin.length < 4}>
              {settingMpin ? 'Setting M-PIN...' : 'Set M-PIN & Login'}
            </button>
            <button type="button" style={btn(false)} onClick={() => { if (pendingTokens) loginSuccess(pendingTokens); }}>
              Skip for now
            </button>
          </form>
        )}

        {/* ── Step: Reset M-PIN (forgot) ── */}
        {step === 'reset_mpin' && (
          <form onSubmit={handleResetMpin}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Enter the OTP sent to {phone}, then set your new M-PIN.
            </p>
            {waStatus && (
              <div style={infoBox(waStatus.sent ? 'green' : 'red')}>
                WhatsApp: {waStatus.sent ? '✓ Sent' : `✗ ${waStatus.error ?? 'Failed'}`}
              </div>
            )}
            {devOtp && (
              <div style={infoBox('yellow')}>
                OTP: <strong>{devOtp}</strong>
              </div>
            )}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>OTP</label>
              <input type="text" inputMode="numeric" maxLength={8} placeholder="123456"
                value={otp} onChange={(e) => setOtp(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>New M-PIN</label>
              <PinInput value={newMpin} onChange={setNewMpin} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>Confirm M-PIN</label>
              <PinInput value={confirmMpin} onChange={setConfirmMpin} placeholder="● ● ● ●" />
            </div>
            <button type="submit" style={btn()} disabled={resettingMpin || !otp || newMpin.length < 4 || confirmMpin.length < 4}>
              {resettingMpin ? 'Resetting...' : 'Reset M-PIN & Login'}
            </button>
            <button type="button" style={btn(false)} onClick={() => { setStep('phone'); setOtp(''); setNewMpin(''); setConfirmMpin(''); }}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
