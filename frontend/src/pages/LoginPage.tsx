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
  | 'phone'
  | 'mpin'
  | 'otp'
  | 'set_mpin'
  | 'reset_mpin';

// ── Theme colours ─────────────────────────────────────────────────────────────
const T = {
  primary:     '#C4572B',
  primaryDark: '#9C3F1E',
  cream:       '#F5F0E5',
  creamBorder: '#E8D9C0',
  inputBorder: '#DDD0C8',
  labelColor:  '#8A6050',
  mutedText:   '#A08070',
  pinBg:       '#FDF8F5',
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.9rem',
  border: `1px solid ${T.inputBorder}`, borderRadius: 8,
  fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
  letterSpacing: '0.15em', textAlign: 'center', background: T.pinBg,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, marginBottom: 6,
  fontSize: '0.8rem', textTransform: 'uppercase',
  letterSpacing: '0.05em', color: T.labelColor,
};

const btn = (primary = true): React.CSSProperties => ({
  width: '100%', padding: '0.75rem', borderRadius: 10, border: 'none',
  background: primary ? T.primary : '#f3f4f6',
  color: primary ? 'white' : '#374151',
  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginTop: '0.5rem',
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
    padding: '0.5rem 0.9rem', marginBottom: '0.75rem',
    fontSize: '0.8rem', color: map.text,
  };
};

// ── PinInput — defined OUTSIDE component to prevent unmount/remount ───────────
const PinInput = ({ value, onChange, placeholder = '● ● ● ●', autoFocus = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) => (
  <input
    type="password"
    inputMode="numeric"
    maxLength={4}
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
    onBlur={(e) => { if (e.target.value.length < 4) setTimeout(() => e.target.focus(), 10); }}
    style={inputStyle}
    autoFocus={autoFocus}
  />
);

// ── Building SVG illustration ────────────────────────────────────────────────
const BuildingHeader = () => (
  <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#E8CFC4' }}>
    <svg viewBox="0 0 320 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="200" fill="#E8CFC4"/>
      {/* Trees */}
      <ellipse cx="60" cy="140" rx="40" ry="35" fill="#5A8A3C" opacity="0.7"/>
      <rect x="57" y="140" width="6" height="30" fill="#6B4C2A"/>
      <ellipse cx="265" cy="145" rx="35" ry="30" fill="#5A8A3C" opacity="0.7"/>
      <rect x="262" y="145" width="6" height="25" fill="#6B4C2A"/>
      <ellipse cx="290" cy="138" rx="28" ry="25" fill="#4A7A2C" opacity="0.8"/>
      {/* Side wing */}
      <rect x="48" y="80" width="40" height="90" fill="#F0EBE0"/>
      <rect x="48" y="80" width="40" height="7" fill="#C4572B"/>
      <rect x="48" y="115" width="40" height="7" fill="#C4572B"/>
      <rect x="48" y="150" width="40" height="7" fill="#C4572B"/>
      <rect x="55" y="91" width="14" height="20" fill="#B8C8D8" rx="1"/>
      <rect x="55" y="125" width="14" height="20" fill="#B8C8D8" rx="1"/>
      {/* Main building */}
      <rect x="85" y="55" width="155" height="115" fill="#F5F0E5"/>
      <rect x="85" y="55" width="155" height="8" fill="#C4572B"/>
      <rect x="85" y="95" width="155" height="8" fill="#C4572B"/>
      <rect x="85" y="133" width="155" height="8" fill="#C4572B"/>
      <rect x="85" y="163" width="155" height="7" fill="#C4572B"/>
      {/* Windows row 1 */}
      <rect x="97" y="67" width="22" height="24" fill="#B8C8D8" rx="2"/>
      <rect x="128" y="67" width="22" height="24" fill="#B8C8D8" rx="2"/>
      <rect x="159" y="67" width="22" height="24" fill="#B8C8D8" rx="2"/>
      <rect x="207" y="67" width="22" height="24" fill="#B8C8D8" rx="2"/>
      {/* Windows row 2 */}
      <rect x="97" y="106" width="22" height="24" fill="#B8C8D8" rx="2"/>
      <rect x="128" y="106" width="22" height="24" fill="#B8C8D8" rx="2"/>
      <rect x="159" y="106" width="22" height="24" fill="#B8C8D8" rx="2"/>
      <rect x="207" y="106" width="22" height="24" fill="#B8C8D8" rx="2"/>
      {/* Balcony bands */}
      <rect x="93" y="63" width="30" height="4" fill="#C4572B"/>
      <rect x="124" y="63" width="30" height="4" fill="#C4572B"/>
      <rect x="155" y="63" width="30" height="4" fill="#C4572B"/>
      <rect x="93" y="102" width="30" height="4" fill="#C4572B"/>
      <rect x="124" y="102" width="30" height="4" fill="#C4572B"/>
      <rect x="155" y="102" width="30" height="4" fill="#C4572B"/>
      {/* Gate */}
      <rect x="135" y="143" width="55" height="27" fill="#9C3F1E"/>
      <rect x="141" y="148" width="18" height="22" fill="#6B4C2A" rx="1"/>
      <rect x="166" y="148" width="18" height="22" fill="#6B4C2A" rx="1"/>
      {/* Compound wall */}
      <rect x="85" y="165" width="155" height="5" fill="#E8D9C0"/>
      {/* Ground */}
      <rect x="0" y="168" width="320" height="32" fill="#C8B8A0"/>
      <rect x="0" y="178" width="320" height="22" fill="#B0A090"/>
    </svg>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
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
  const [pendingTokens, setPendingTokens] = useState<{ access_token: string; refresh_token: string; user: object } | null>(null);

  const [requestOtp, { isLoading: sendingOtp }] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: verifyingOtp }] = useVerifyOtpMutation();
  const [verifyMpin, { isLoading: verifyingMpin }] = useVerifyMpinMutation();
  const [setMpinMutation, { isLoading: settingMpin }] = useSetMpinMutation();
  const [resetMpin, { isLoading: resettingMpin }] = useResetMpinMutation();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const clearErr = () => setError('');

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); clearErr();
    try {
      const res = await fetch(`${API_BASE}/auth/mpin/status?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json?.data?.has_mpin) { setStep('mpin'); }
      else { await sendOtp(); setStep('otp'); }
    } catch { setError('Failed to connect to server.'); }
  };

  const sendOtp = async () => {
    const result = await requestOtp({ phone }).unwrap();
    if (result?.data?.wa_status) setWaStatus(result.data.wa_status as { sent: boolean; error?: string });
    if (result?.data?.dev_otp) setDevOtp(result.data.dev_otp as string);
  };

  const handleMpinLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clearErr();
    try {
      const result = await verifyMpin({ phone, mpin }).unwrap();
      loginSuccess(result.data as never);
    } catch (err: unknown) {
      setError(extractError(err, 'Incorrect M-PIN.')); setMpin('');
    }
  };

  const handleForgotMpin = async () => {
    clearErr(); setDevOtp(null); setWaStatus(null);
    try { await sendOtp(); setStep('reset_mpin'); }
    catch (err: unknown) { setError(extractError(err, 'Failed to send OTP.')); }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault(); clearErr();
    try {
      const result = await verifyOtp({ phone, otp }).unwrap();
      const tokens = result.data as { access_token: string; refresh_token: string; user: object };
      setPendingTokens(tokens); setOtp(''); setStep('set_mpin');
    } catch (err: unknown) { setError(extractError(err, 'Invalid OTP.')); }
  };

  const handleSetMpin = async (e: React.FormEvent) => {
    e.preventDefault(); clearErr();
    if (newMpin !== confirmMpin) { setError('PINs do not match.'); return; }
    try {
      dispatch(baseApi.util.resetApiState());
      dispatch(setCredentials(pendingTokens as never));
      await setMpinMutation({ mpin: newMpin }).unwrap();
      navigate('/dashboard');
    } catch (err: unknown) { setError(extractError(err, 'Failed to set M-PIN.')); }
  };

  const handleResetMpin = async (e: React.FormEvent) => {
    e.preventDefault(); clearErr();
    if (newMpin !== confirmMpin) { setError('PINs do not match.'); return; }
    try {
      await resetMpin({ phone, otp, new_mpin: newMpin }).unwrap();
      const result = await verifyMpin({ phone, mpin: newMpin }).unwrap();
      loginSuccess(result.data as never);
    } catch (err: unknown) { setError(extractError(err, 'Reset failed.')); }
  };

  const loginSuccess = (tokens: { access_token: string; refresh_token: string; user: object }) => {
    dispatch(baseApi.util.resetApiState());
    dispatch(setCredentials(tokens as never));
    navigate('/dashboard');
  };

  const extractError = (err: unknown, fallback: string) =>
    (err as { data?: { detail?: string } })?.data?.detail ?? fallback;

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      alignItems: 'center', justifyContent: 'center',
      background: T.cream,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
        border: `1px solid ${T.creamBorder}`,
      }}>
        {/* Building illustration header */}
        <BuildingHeader />

        {/* Login card body */}
        <div style={{ background: '#FFFFFF', padding: '20px 24px 28px' }}>
          {/* Branding */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.primaryDark, letterSpacing: 0.5 }}>
              SmartAppt
            </div>
            <div style={{ fontSize: 12, color: T.mutedText, marginTop: 3 }}>
              Apartment Association Management
            </div>
          </div>

          {error && <div style={errBox}>{error}</div>}

          {/* ── Phone ── */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Mobile number</label>
                <input type="tel" placeholder="+91 98765 43210" value={phone}
                  onChange={(e) => setPhone(e.target.value)} required style={inputStyle} autoFocus />
              </div>
              <button type="submit" style={btn()} disabled={sendingOtp}>
                {sendingOtp ? 'Checking...' : 'Continue'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/register" style={{ fontSize: '0.875rem', color: T.primary, fontWeight: 600 }}>
                  Register Association
                </Link>
              </div>
            </form>
          )}

          {/* ── M-PIN login ── */}
          {step === 'mpin' && (
            <form onSubmit={handleMpinLogin}>
              <p style={{ color: T.mutedText, fontSize: '0.875rem', marginBottom: '1rem' }}>
                Enter your 4-digit M-PIN for {phone}
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>M-PIN</label>
                <PinInput value={mpin} onChange={setMpin} autoFocus />
              </div>
              <button type="submit" style={btn()} disabled={verifyingMpin || mpin.length < 4}>
                {verifyingMpin ? 'Verifying...' : 'Login'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <span style={{ fontSize: 13, color: T.primary, cursor: 'pointer', fontWeight: 600 }}
                  onClick={handleForgotMpin}>
                  {sendingOtp ? 'Sending OTP...' : 'Forgot M-PIN?'}
                </span>
                <span style={{ fontSize: 13, color: T.primary, cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => { setMpin(''); setStep('phone'); }}>
                  Change number
                </span>
              </div>
            </form>
          )}

          {/* ── OTP (first login) ── */}
          {step === 'otp' && (
            <form onSubmit={handleOtpVerify}>
              <p style={{ color: T.mutedText, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                OTP sent via WhatsApp to {phone}
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
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Enter OTP</label>
                <input type="text" inputMode="numeric" maxLength={8} placeholder="123456"
                  value={otp} onChange={(e) => setOtp(e.target.value)} required style={inputStyle} autoFocus />
              </div>
              <button type="submit" style={btn()} disabled={verifyingOtp}>
                {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button type="button" style={btn(false)}
                onClick={() => { setOtp(''); setStep('phone'); setWaStatus(null); setDevOtp(null); }}>
                Change number
              </button>
            </form>
          )}

          {/* ── Set M-PIN (first time) ── */}
          {step === 'set_mpin' && (
            <form onSubmit={handleSetMpin}>
              <p style={{ color: T.mutedText, fontSize: '0.875rem', marginBottom: '1rem' }}>
                Set a 4-digit M-PIN for faster logins next time.
              </p>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>New M-PIN</label>
                <PinInput value={newMpin} onChange={setNewMpin} autoFocus />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Confirm M-PIN</label>
                <PinInput value={confirmMpin} onChange={setConfirmMpin} />
              </div>
              <button type="submit" style={btn()}
                disabled={settingMpin || newMpin.length < 4 || confirmMpin.length < 4}>
                {settingMpin ? 'Setting M-PIN...' : 'Set M-PIN & Login'}
              </button>
              <button type="button" style={btn(false)}
                onClick={() => { if (pendingTokens) loginSuccess(pendingTokens); }}>
                Skip for now
              </button>
            </form>
          )}

          {/* ── Reset M-PIN (forgot) ── */}
          {step === 'reset_mpin' && (
            <form onSubmit={handleResetMpin}>
              <p style={{ color: T.mutedText, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
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
                <label style={labelStyle}>OTP</label>
                <input type="text" inputMode="numeric" maxLength={8} placeholder="123456"
                  value={otp} onChange={(e) => setOtp(e.target.value)} required style={inputStyle} autoFocus />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>New M-PIN</label>
                <PinInput value={newMpin} onChange={setNewMpin} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Confirm M-PIN</label>
                <PinInput value={confirmMpin} onChange={setConfirmMpin} />
              </div>
              <button type="submit" style={btn()}
                disabled={resettingMpin || !otp || newMpin.length < 4 || confirmMpin.length < 4}>
                {resettingMpin ? 'Resetting...' : 'Reset M-PIN & Login'}
              </button>
              <button type="button" style={btn(false)}
                onClick={() => { setStep('phone'); setOtp(''); setNewMpin(''); setConfirmMpin(''); }}>
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: T.cream, padding: '10px',
          textAlign: 'center', borderTop: `1px solid ${T.creamBorder}`,
        }}>
          <div style={{ fontSize: 10, color: T.mutedText }}>
            Powered by Integrata • Secure &amp; Private
          </div>
        </div>
      </div>
    </div>
  );
}
