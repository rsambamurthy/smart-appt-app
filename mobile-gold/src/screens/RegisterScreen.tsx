import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { api } from '../api/client';

const T = {
  primary:    '#7C3AED',
  bg:         '#F5F3FF',
  cardBorder: '#DDD6FE',
  inputBorder:'#C4B5FD',
  label:      '#5B21B6',
};

function Field({ label, value, onChange, placeholder, keyboard = 'default', maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; maxLength?: number;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#c4b5fd"
        keyboardType={keyboard}
        maxLength={maxLength}
        autoCapitalize="words"
      />
    </View>
  );
}

export default function RegisterScreen({ navigation }: { navigation: any }) {
  const [name,       setName]       = useState('');
  const [address,    setAddress]    = useState('');
  const [city,       setCity]       = useState('');
  const [state,      setState]      = useState('');
  const [pincode,    setPincode]    = useState('');
  const [adminName,  setAdminName]  = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !adminName.trim() || !adminPhone.trim()) {
      setError('Association name, manager name and phone are required.');
      return;
    }
    setLoading(true); setError('');
    try {
      await api.post('/associations/register', {
        name, address, city, state, pincode,
        admin_name: adminName, admin_phone: adminPhone,
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoHeader}>
          <Image source={require('../../assets/smartappt-logo.png')} style={s.logoImage} resizeMode="cover" />
          <View style={s.goldStrip}>
            <Text style={s.goldStripText}>✦  SmartAppt Gold  ✦</Text>
          </View>
        </View>

        <View style={s.card}>

          {success ? (
            <View style={s.successBox}>
              <Text style={s.successIcon}>✓</Text>
              <Text style={s.successTitle}>Association Registered!</Text>
              <Text style={s.successSub}>
                An OTP will be sent to {adminPhone} via WhatsApp.{'\n'}
                Use that number to log in.
              </Text>
              <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
                <Text style={s.btnText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.heading}>Register Association</Text>
              <Text style={s.sub}>Set up your apartment association to get started</Text>

              {error ? (
                <View style={s.errBox}><Text style={s.errText}>{error}</Text></View>
              ) : null}

              {/* Association Details */}
              <Text style={s.section}>Association Details</Text>
              <Field label="Association Name *" value={name} onChange={setName}
                placeholder="e.g. Sunrise Apartments Owners Association" />
              <Field label="Address" value={address} onChange={setAddress}
                placeholder="Street address" />
              <View style={s.row3}>
                <View style={{ flex: 1 }}>
                  <Field label="City" value={city} onChange={setCity} placeholder="City" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="State" value={state} onChange={setState} placeholder="State" />
                </View>
                <View style={{ width: 90 }}>
                  <Field label="Pincode" value={pincode} onChange={setPincode}
                    placeholder="600001" keyboard="number-pad" maxLength={10} />
                </View>
              </View>

              {/* Admin Details */}
              <Text style={[s.section, { marginTop: 16 }]}>Association Manager</Text>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Field label="Full Name *" value={adminName} onChange={setAdminName}
                    placeholder="Manager's full name" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Phone *" value={adminPhone} onChange={setAdminPhone}
                    placeholder="+91 98765 43210" keyboard="phone-pad" />
                </View>
              </View>
              <Text style={s.hint}>This phone number will be used to log in via OTP.</Text>

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Register Association</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Login')}>
                <Text style={s.linkText}>Already registered? Sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={s.footer}>Powered by Integrata • Secure &amp; Private</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bg },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoHeader:   { marginBottom: 20, borderRadius: 20, overflow: 'hidden', elevation: 4,
                  shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logoImage:    { width: '100%', height: 180 },
  goldStrip:    { backgroundColor: '#1e1b4b', paddingVertical: 10, alignItems: 'center' },
  goldStripText:{ color: '#F59E0B', fontSize: 13, fontWeight: '700', letterSpacing: 2 },

  card:         { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1,
                  borderColor: T.cardBorder, elevation: 4, shadowColor: '#7C3AED',
                  shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },

  heading:      { fontSize: 18, fontWeight: '800', color: '#1e1b4b', marginBottom: 4 },
  sub:          { fontSize: 13, color: '#64748b', marginBottom: 16 },
  section:      { fontSize: 11, fontWeight: '700', color: T.label, textTransform: 'uppercase',
                  letterSpacing: 0.8, marginBottom: 10, borderBottomWidth: 1,
                  borderBottomColor: '#EDE9FE', paddingBottom: 6 },

  fieldWrap:    { marginBottom: 12 },
  label:        { fontSize: 11, fontWeight: '700', color: T.label, textTransform: 'uppercase',
                  letterSpacing: 0.8, marginBottom: 6 },
  input:        { borderWidth: 1.5, borderColor: T.inputBorder, borderRadius: 10, paddingVertical: 11,
                  paddingHorizontal: 14, fontSize: 14, color: '#1e1b4b', backgroundColor: '#FDFCFF' },

  row2:         { flexDirection: 'row', gap: 10 },
  row3:         { flexDirection: 'row', gap: 8 },

  hint:         { fontSize: 11, color: '#94a3b8', marginBottom: 16, marginTop: -4 },
  errBox:       { backgroundColor: '#fee2e2', borderRadius: 10, padding: 12, marginBottom: 14 },
  errText:      { color: '#991b1b', fontSize: 13 },

  btn:          { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 15,
                  alignItems: 'center', elevation: 2, marginTop: 4 },
  btnDisabled:  { opacity: 0.45 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700' },

  link:         { alignItems: 'center', marginTop: 16 },
  linkText:     { color: T.primary, fontSize: 13, fontWeight: '700' },

  successBox:   { alignItems: 'center', padding: 16 },
  successIcon:  { fontSize: 48, color: '#16a34a', marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#166534', marginBottom: 10 },
  successSub:   { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  footer:       { textAlign: 'center', color: '#a5b4fc', fontSize: 11, marginTop: 24 },
});
