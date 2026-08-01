/**
 * "More" screen — lists overflow sections that didn't fit in the bottom bar,
 * plus account info and sign-out. Same UX as SmartAppt Lite.
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAppDispatch, useAppSelector } from '../store';
import { clearCredentials } from '../store/authSlice';
import { setAuthToken } from '../api/client';
import { visibleCategories } from '../navigation/menuConfig';

const PRIMARY = '#7C3AED';

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const dispatch   = useAppDispatch();
  const user       = useAppSelector(s => s.auth.user);
  const config     = useAppSelector(s => s.auth.mobileConfig);

  const categories = visibleCategories(config);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await SecureStore.deleteItemAsync('access_token').catch(() => {});
        setAuthToken(null);
        dispatch(clearCredentials());
      }},
    ]);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.profileName}>{user?.name ?? 'User'}</Text>
          <Text style={s.profileRole}>{user?.role?.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {categories.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Sections</Text>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={s.row}
              onPress={() => navigation.navigate('Category', { categoryId: cat.id, title: cat.label })}
              activeOpacity={0.7}
            >
              <View style={[s.iconWrap, { backgroundColor: cat.color + '20' }]}>
                <Ionicons name={cat.icon} size={20} color={cat.color} />
              </View>
              <Text style={s.rowLabel}>{cat.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </>
      )}

      <Text style={[s.sectionTitle, { marginTop: categories.length > 0 ? 24 : 0 }]}>Account</Text>
      <TouchableOpacity style={s.row} onPress={handleLogout} activeOpacity={0.7}>
        <View style={[s.iconWrap, { backgroundColor: '#fef2f2' }]}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        </View>
        <Text style={[s.rowLabel, { color: '#ef4444' }]}>Sign Out</Text>
        <Ionicons name="chevron-forward" size={18} color="#fca5a5" />
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F3FF' },
  content:      { padding: 16, paddingBottom: 40 },
  profileCard:  {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileName:  { fontSize: 16, fontWeight: '700', color: '#1e1b4b' },
  profileRole:  { fontSize: 12, color: '#7C3AED', marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#5B21B6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 6,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  iconWrap:  { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  rowLabel:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },
});
