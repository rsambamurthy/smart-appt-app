import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector, useAppDispatch } from '../store';
import { clearCredentials } from '../store/authSlice';
import { setAuthToken } from '../api/client';
import * as SecureStore from 'expo-secure-store';

const PRIMARY = '#7C3AED';

interface Tile {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tab: string;
  screen: string;
  itemId?: string;
}

const TILES: Tile[] = [
  { label: 'My Bills',        icon: 'receipt-outline',       color: '#f59e0b', tab: 'Dues',       screen: 'MyBills',       itemId: 'dues_my_bills'     },
  { label: 'Announcements',   icon: 'megaphone-outline',     color: '#22c55e', tab: 'Community',  screen: 'Announcements', itemId: 'announcements_feed'},
  { label: 'Maintenance',     icon: 'construct-outline',     color: '#ef4444', tab: 'Community',  screen: 'Maintenance',   itemId: 'maintenance_list'  },
  { label: 'Visitors',        icon: 'people-outline',        color: '#0891b2', tab: 'More',       screen: 'Visitors',      itemId: 'visitors_log'      },
  { label: 'Journal Entries', icon: 'book-outline',          color: '#7C3AED', tab: 'Accounting', screen: 'Journal',       itemId: 'journal_entries'   },
  { label: 'Ledger',          icon: 'list-outline',          color: '#16a34a', tab: 'Accounting', screen: 'Ledger',        itemId: 'ledger'            },
  { label: 'P&L Report',      icon: 'trending-up-outline',   color: '#f59e0b', tab: 'Accounting', screen: 'PnL',           itemId: 'pnl'               },
  { label: 'Balance Sheet',   icon: 'scale-outline',         color: '#0891b2', tab: 'Accounting', screen: 'BalanceSheet',  itemId: 'balance_sheet'     },
  { label: 'Chart of Accounts', icon: 'layers-outline',      color: '#8b5cf6', tab: 'Accounting', screen: 'COA',           itemId: 'coa'               },
  { label: 'FY Closure',      icon: 'lock-closed-outline',   color: '#dc2626', tab: 'Accounting', screen: 'FYClosure',     itemId: 'fy_closure'        },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function HomeScreen({ navigation }: any) {
  const dispatch     = useAppDispatch();
  const user         = useAppSelector(s => s.auth.user);
  const mobileConfig = useAppSelector(s => s.auth.mobileConfig);

  const visibleTiles = TILES.filter(t => {
    if (!t.itemId || !mobileConfig) return true;
    // Map tile itemId → the feature flag stored in mobileConfig
    const featureMap: Record<string, keyof typeof mobileConfig> = {
      dues_my_bills:      'feature_bills',
      announcements_feed: 'feature_announcements',
      maintenance_list:   'feature_complaints',
      visitors_log:       'feature_visitors',
      journal_entries:    'feature_journal',
      ledger:             'feature_ledger',
      pnl:                'feature_pnl',
      balance_sheet:      'feature_balance_sheet',
      coa:                'feature_coa',
      fy_closure:         'feature_fy_closure',
    };
    const flag = featureMap[t.itemId];
    if (flag) return mobileConfig[flag] !== false;
    return true;
  });

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('access_token').catch(() => {});
    setAuthToken(null);
    dispatch(clearCredentials());
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Header card */}
      <View style={s.headerCard}>
        <View>
          <Text style={s.greeting}>{greeting()},</Text>
          <Text style={s.userName}>{user?.name ?? 'Resident'}</Text>
          <Text style={s.role}>{user?.role?.replace(/_/g, ' ')}</Text>
          {user?.unit_number ? <Text style={s.unit}>Unit {user.unit_number}</Text> : null}
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick access grid */}
      <Text style={s.sectionTitle}>Quick Access</Text>
      <View style={s.grid}>
        {visibleTiles.map(tile => (
          <TouchableOpacity
            key={tile.label}
            style={[s.tile, { borderTopColor: tile.color }]}
            onPress={() => navigation.navigate(tile.tab, { screen: tile.screen })}
            activeOpacity={0.8}
          >
            <View style={[s.tileIcon, { backgroundColor: tile.color + '20' }]}>
              <Ionicons name={tile.icon} size={22} color={tile.color} />
            </View>
            <Text style={s.tileLabel}>{tile.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
  role:     { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  tile: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tileIcon:  {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
});
