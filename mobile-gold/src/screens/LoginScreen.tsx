import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAppDispatch } from '../store';
import { setCredentials, setMobileConfig } from '../store/authSlice';
import { api, setAuthToken } from '../api/client';
import type { MobileConfigResponse } from '../api/types';

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  primary:    '#7C3AED',
  primaryDk:  '#5B21B6',
  bg:         '#F5F3FF',
  cardBorder: '#DDD6FE',
  inputBorder:'#C4B5FD',
  label:      '#5B21B6',
  muted:      '#7C3AED',
  mutedTxt:   '#6D28D9',
  pinBg:      '#FDFCFF',
};

type Step = 'phone' | 'mpin' | 'otp' | 'set_mpin' | 'reset_mpin';

// ── PIN input (4 digits, masked) ──────────────────────────────────────────────
function PinInput({ value, onChange, autoFocus = false }: {
  value: string; onChange: (v: string) => void; autoFocus?: boolean;
}) {
  return (
    <TextInput
      style={s.pinInput}
      keyboardType="number-pad"
      maxLength={4}
      secureTextEntry
      placeholder="● ● ● ●"
      placeholderTextColor="#c4b5fd"
      value={value}
      onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, 4))}
      autoFocus={autoFocus}
    />
  );
}

// ── Logo header ───────────────────────────────────────────────────────────────
function LogoHeader() {
  return (
    <View style={s.logoHeader}>
      <Image
        source={require('../../assets/smartappt-logo.png')}
        style={s.logoImage}
        resizeMode="cover"
      />
      {/* Gold badge strip */}
      <View style={s.goldStrip}>
        <Text style={s.goldStripText}>✦  SmartAppt Gold  ✦</Text>
      </View>
    </View>
  );
}

// ── Error box ─────────────────────────────────────────────────────────────────
function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return <View style={s.errBox}><Text style={s.errText}>{msg}</Text></View>;
}

// ── Info box ──────────────────────────────────────────────────────────────────
function InfoBox({ msg, color }: { msg: string; color: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green:  { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    yellow: { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    red:    { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  }[color];
  return (
    <View style={[s.infoBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontSize: 13 }}>{msg}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }: { navigation: any }) {
  const dispatch = useAppDispatch();

  const [step,         setStep]         = useState<Step>('phone');
  const [phone,        setPhone]        = useState('');
  const [mpin,         setMpin]         = useState('');
  const [otp,          setOtp]          = useState('');
  const [newMpin,      setNewMpin]      = useState('');
  const [confirmMpin,  setConfirmMpin]  = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [devOtp,       setDevOtp]       = useState<string | null>(null);
  const [waSent,       setWaSent]       = useState<boolean | null>(null);
  const [pendingTokens, setPendingTokens] = useState<{ access_token: string; refresh_token?: string; user: object } | null>(null);

  const clearErr = () => setError('');

  // ── Fetch mobile config after login ────────────────────────────────────────
  const afterLogin = async (tokens: { access_token: string; user: object }) => {
    await SecureStore.setItemAsync('access_token', tokens.access_token);
    setAuthToken(tokens.access_token);
    dispatch(setCredentials({ access_token: tokens.access_token, user: tokens.user as never }));
    try {
      const cfg = await api.get<MobileConfigResponse>('/system/mobile-config');
      dispatch(setMobileConfig(cfg));
    } catch {}
  };

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    const res = await api.post<{ data: { wa_status?: { sent: boolean }; dev_otp?: string } }>(
      '/auth/otp/request', { phone });
    setWaSent(res.data?.wa_status?.sent ?? null);
    setDevOtp(res.data?.dev_otp ?? null);
  };

  // ── Step: phone ───────────────────────────────────────────────────────────
  const handlePhone = async () => {
    if (!phone.trim()) { Alert.alert('Error', 'Enter your mobile number.'); return; }
    setLoading(true); clearErr();
    try {
      const res = await api.get<{ data: { has_mpin: boolean } }>(`/auth/mpin/status?phone=${encodeURIComponent(phone)}`);
      if (res.data?.has_mpin) {
        setStep('mpin');
      } else {
        await sendOtp();
        setStep('otp');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not connect to server.');
    } finally { setLoading(false); }
  };

  // ── Step: mpin ────────────────────────────────────────────────────────────
  const handleMpinLogin = async () => {
    if (mpin.length < 4) return;
    setLoading(true); clearErr();
    try {
      const res = await api.post<{ data: { access_token: string; user: object } }>(
        '/auth/mpin/verify', { phone, mpin });
      await afterLogin(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Incorrect M-PIN.');
      setMpin('');
    } finally { setLoading(false); }
  };

  const handleForgotMpin = async () => {
    setLoading(true); clearErr(); setDevOtp(null); setWaSent(null);
    try {
      await sendOtp();
      setStep('reset_mpin');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  // ── Step: otp ─────────────────────────────────────────────────────────────
  const handleOtpVerify = async () => {
    if (!otp.trim()) return;
    setLoading(true); clearErr();
    try {
      const res = await api.post<{ data: { access_token: string; refresh_token?: string; user: object } }>(
        '/auth/otp/verify', { phone, otp });
      setPendingTokens(res.data);
      setOtp('');
      setStep('set_mpin');
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Invalid OTP.');
    } finally { setLoading(false); }
  };

  // ── Step: set_mpin ────────────────────────────────────────────────────────
  const handleSetMpin = async () => {
    if (newMpin.length < 4 || confirmMpin.length < 4) return;
    if (newMpin !== confirmMpin) { setError('PINs do not match.'); return; }
    if (!pendingTokens) return;
    setLoading(true); clearErr();
    try {
      await SecureStore.setItemAsync('access_token', pendingTokens.access_token);
      setAuthToken(pendingTokens.access_token);
      dispatch(setCredentials({ access_token: pendingTokens.access_token, user: pendingTokens.user as never }));
      await api.post('/auth/mpin/set', { mpin: newMpin });
      try {
        const cfg = await api.get<MobileConfigResponse>('/system/mobile-config');
        dispatch(setMobileConfig(cfg));
      } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to set M-PIN.');
    } finally { setLoading(false); }
  };

  const handleSkipMpin = async () => {
    if (!pendingTokens) return;
    await afterLogin(pendingTokens);
  };

  // ── Step: reset_mpin ──────────────────────────────────────────────────────
  const handleResetMpin = async () => {
    if (!otp || newMpin.length < 4 || confirmMpin.length < 4) return;
    if (newMpin !== confirmMpin) { setError('PINs do not match.'); return; }
    setLoading(true); clearErr();
    try {
      await api.post('/auth/mpin/reset', { phone, otp, new_mpin: newMpin });
      const res = await api.post<{ data: { access_token: string; user: object } }>(
        '/auth/mpin/verify', { phone, mpin: newMpin });
      await afterLogin(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Reset failed.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <LogoHeader />

        <View style={s.card}>

          <ErrBox msg={error} />

          {/* ── Phone ─────────────────────────────────────── */}
          {step === 'phone' && (
            <>
              <Text style={s.label}>Mobile number</Text>
              <TextInput
                style={s.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#c4b5fd"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handlePhone}
              />
              <TouchableOpacity style={s.btn} onPress={handlePhone} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── MPIN ──────────────────────────────────────── */}
          {step === 'mpin' && (
            <>
              <Text style={s.subText}>Enter your 4-digit M-PIN for {phone}</Text>
              <Text style={s.label}>M-PIN</Text>
              <PinInput value={mpin} onChange={setMpin} autoFocus />
              <TouchableOpacity style={[s.btn, mpin.length < 4 && s.btnDisabled]}
                onPress={handleMpinLogin} disabled={loading || mpin.length < 4} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
              </TouchableOpacity>
              <View style={s.row}>
                <TouchableOpacity onPress={handleForgotMpin} disabled={loading}>
                  <Text style={s.link}>{loading ? 'Sending OTP…' : 'Forgot M-PIN?'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setMpin(''); setStep('phone'); }}>
                  <Text style={s.link}>Change number</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── OTP ───────────────────────────────────────── */}
          {step === 'otp' && (
            <>
              <Text style={s.subText}>OTP sent via WhatsApp to {phone}</Text>
              {waSent !== null && (
                <InfoBox msg={waSent ? '✓ WhatsApp OTP sent' : '✗ WhatsApp delivery failed'} color={waSent ? 'green' : 'red'} />
              )}
              {devOtp && <InfoBox msg={`OTP: ${devOtp}`} color="yellow" />}
              <Text style={s.label}>Enter OTP</Text>
              <TextInput
                style={s.input}
                placeholder="123456"
                placeholderTextColor="#c4b5fd"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
              <TouchableOpacity style={s.btn} onPress={handleOtpVerify} disabled={loading || !otp} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary}
                onPress={() => { setOtp(''); setStep('phone'); setWaSent(null); setDevOtp(null); }}>
                <Text style={s.btnSecondaryText}>Change number</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Set MPIN ──────────────────────────────────── */}
          {step === 'set_mpin' && (
            <>
              <Text style={s.subText}>Set a 4-digit M-PIN for faster logins next time.</Text>
              <Text style={s.label}>New M-PIN</Text>
              <PinInput value={newMpin} onChange={setNewMpin} autoFocus />
              <Text style={[s.label, { marginTop: 14 }]}>Confirm M-PIN</Text>
              <PinInput value={confirmMpin} onChange={setConfirmMpin} />
              <TouchableOpacity
                style={[s.btn, (newMpin.length < 4 || confirmMpin.length < 4) && s.btnDisabled]}
                onPress={handleSetMpin}
                disabled={loading || newMpin.length < 4 || confirmMpin.length < 4}
                activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Set M-PIN & Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={handleSkipMpin}>
                <Text style={s.btnSecondaryText}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Reset MPIN ────────────────────────────────── */}
          {step === 'reset_mpin' && (
            <>
              <Text style={s.subText}>Enter the OTP sent to {phone}, then set your new M-PIN.</Text>
              {waSent !== null && (
                <InfoBox msg={waSent ? '✓ WhatsApp OTP sent' : '✗ WhatsApp delivery failed'} color={waSent ? 'green' : 'red'} />
              )}
              {devOtp && <InfoBox msg={`OTP: ${devOtp}`} color="yellow" />}
              <Text style={s.label}>OTP</Text>
              <TextInput
                style={s.input}
                placeholder="123456"
                placeholderTextColor="#c4b5fd"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
              <Text style={[s.label, { marginTop: 14 }]}>New M-PIN</Text>
              <PinInput value={newMpin} onChange={setNewMpin} />
              <Text style={[s.label, { marginTop: 14 }]}>Confirm M-PIN</Text>
              <PinInput value={confirmMpin} onChange={setConfirmMpin} />
              <TouchableOpacity
                style={[s.btn, (!otp || newMpin.length < 4 || confirmMpin.length < 4) && s.btnDisabled]}
                onPress={handleResetMpin}
                disabled={loading || !otp || newMpin.length < 4 || confirmMpin.length < 4}
                activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Reset M-PIN & Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary}
                onPress={() => { setStep('phone'); setOtp(''); setNewMpin(''); setConfirmMpin(''); }}>
                <Text style={s.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

        </View>

        {/* Register link — only on phone step */}
        {step === 'phone' && (
          <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => navigation.navigate('Register')}>
            <Text style={{ color: '#7C3AED', fontSize: 13, fontWeight: '700' }}>
              New association? Register here
            </Text>
          </TouchableOpacity>
        )}

        {/* Footer */}
        <Text style={s.footer}>Powered by Integrata • Secure &amp; Private</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.bg },
  scroll:          { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // Logo header
  logoHeader:      { marginBottom: 20, borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logoImage:       { width: '100%', height: 180 },
  goldStrip:       { backgroundColor: '#1e1b4b', paddingVertical: 10, alignItems: 'center' },
  goldStripText:   { color: '#F59E0B', fontSize: 13, fontWeight: '700', letterSpacing: 2 },

  // Card
  card:            { backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: T.cardBorder, elevation: 4, shadowColor: '#7C3AED', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },

  // Form elements
  label:           { fontSize: 11, fontWeight: '700', color: T.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  subText:         { fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 18 },
  input:           { borderWidth: 1.5, borderColor: T.inputBorder, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, color: '#1e1b4b', backgroundColor: T.pinBg, textAlign: 'center', letterSpacing: 2, marginBottom: 16 },
  pinInput:        { borderWidth: 1.5, borderColor: T.inputBorder, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, fontSize: 22, color: '#1e1b4b', backgroundColor: T.pinBg, textAlign: 'center', letterSpacing: 6, marginBottom: 16 },

  // Buttons
  btn:             { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', elevation: 2, marginTop: 4 },
  btnDisabled:     { opacity: 0.45 },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary:    { backgroundColor: '#f1f0ff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnSecondaryText: { color: T.primary, fontSize: 15, fontWeight: '600' },

  // Misc
  row:             { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link:            { color: T.primary, fontSize: 13, fontWeight: '700' },
  errBox:          { backgroundColor: '#fee2e2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errText:         { color: '#991b1b', fontSize: 13 },
  infoBox:         { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  footer:          { textAlign: 'center', color: '#a5b4fc', fontSize: 11, marginTop: 24 },
});
