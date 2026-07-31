import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../store';
import { clearCredentials } from '../store/authSlice';
import { setAuthToken } from '../api/client';
import * as SecureStore from 'expo-secure-store';

const PRIMARY = '#0095db';

interface QuickLink {
  label: string;
  screen: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  itemId?: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'My Bills',    screen: 'Bills',         icon: 'receipt-outline',       color: '#f59e0b', itemId: 'dues_my_bills'    },
  { label: 'Updates',     screen: 'Announcements', icon: 'megaphone-outline',     color: '#22c55e', itemId: 'announcements_feed'},
  { label: 'Requests',    screen: 'Maintenance',   icon: 'construct-outline',     color: '#ef4444', itemId: 'maintenance_list' },
  { label: 'Visitors',    screen: 'Visitors',      icon: 'people-outline',        color: '#8b5cf6', itemId: 'visitors_log'     },
  { label: 'Journal',     screen: 'Journal',       icon: 'book-outline',          color: '#7c3aed', itemId: 'journal_entries'  },
  { label: 'Ledger',      screen: 'Ledger',        icon: 'list-outline',          color: '#16a34a', itemId: 'ledger'           },
  { label: 'P&L',         screen: 'PnL',           icon: 'trending-up-outline',   color: '#f59e0b', itemId: 'pnl'              },
  { label: 'Balance',     screen: 'BalanceSheet',  icon: 'scale-outline',         color: '#0891b2', itemId: 'balance_sheet'    },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const dispatch   = useAppDispatch();
  const user       = useAppSelector((s) => s.auth.user);
  const config     = useAppSelector((s) => s.auth.mobileConfig);

  const visibleLinks = QUICK_LINKS.filter((l) => {
    if (!l.itemId) return true;
    if (!config?.menu_items) return true;
    return config.menu_items[l.itemId]?.enabled !== false;
  });

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('access_token').catch(() => {});
    setAuthToken(null);
    dispatch(clearCredentials());
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{user?.name ?? 'Resident'}</Text>
          <Text style={styles.role}>{user?.role?.replace('_', ' ')}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick links */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.grid}>
        {visibleLinks.map((link) => (
          <TouchableOpacity
            key={link.screen}
            style={[styles.tile, { borderTopColor: link.color }]}
            onPress={() => navigation.navigate(link.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIcon, { backgroundColor: link.color + '20' }]}>
              <Ionicons name={link.icon} size={22} color={link.color} />
            </View>
            <Text style={styles.tileLabel}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
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
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  greeting:    { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  userName:    { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  role:        { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  logoutBtn:   { padding: 8 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  tileIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
});
