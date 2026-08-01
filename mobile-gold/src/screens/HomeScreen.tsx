import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAppSelector, useAppDispatch } from '../store';
import { clearCredentials } from '../store/authSlice';
import { setAuthToken } from '../api/client';
import { visibleCategories, enabledItems } from '../navigation/menuConfig';

const PRIMARY = '#7C3AED';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const dispatch   = useAppDispatch();
  const user       = useAppSelector(s => s.auth.user);
  const config     = useAppSelector(s => s.auth.mobileConfig);

  const categories = visibleCategories(config);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('access_token').catch(() => {});
    setAuthToken(null);
    dispatch(clearCredentials());
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Header card */}
      <View style={s.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{greeting()},</Text>
          <Text style={s.userName}>{user?.name ?? 'Resident'}</Text>
          <Text style={s.role}>{user?.role?.replace(/_/g, ' ')}</Text>
          {user?.unit_number ? <Text style={s.unit}>Unit {user.unit_number}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('More')} style={s.logoutBtn}>
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category cards */}
      <Text style={s.sectionTitle}>Menu</Text>

      {categories.length === 0 ? (
        <Text style={s.empty}>
          No sections are enabled for your association yet.
        </Text>
      ) : (
        <View style={s.grid}>
          {categories.map(cat => {
            const count = enabledItems(cat, config).length;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[s.card, { borderTopColor: cat.color }]}
                onPress={() => navigation.navigate('Category', { categoryId: cat.id, title: cat.label })}
                activeOpacity={0.8}
              >
                <View style={[s.cardIcon, { backgroundColor: cat.color + '20' }]}>
                  <Ionicons name={cat.icon} size={26} color={cat.color} />
                </View>
                <Text style={s.cardLabel}>{cat.label}</Text>
                <Text style={s.cardCount}>{count} {count === 1 ? 'item' : 'items'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  content:   { padding: 16, paddingBottom: 32 },

  headerCard: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    elevation: 4,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  userName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  role:     { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  unit:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  logoutBtn: { padding: 8 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B21B6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  empty: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 24 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#1e1b4b' },
  cardCount: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
