/**
 * "More" screen — renders overflow tabs that didn't fit in the bottom bar,
 * plus a logout button.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAppDispatch } from '../store';
import { clearCredentials } from '../store/authSlice';
import { setAuthToken } from '../api/client';

interface TabDef {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  overflowTabs?: TabDef[];
}

export default function MoreScreen({ overflowTabs = [] }: Props) {
  const navigation = useNavigation<any>();
  const dispatch   = useAppDispatch();

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('access_token').catch(() => {});
    setAuthToken(null);
    dispatch(clearCredentials());
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {overflowTabs.length > 0 && (
        <>
          <Text style={s.sectionTitle}>More Sections</Text>
          {overflowTabs.map((tab) => (
            <TouchableOpacity
              key={tab.name}
              style={s.row}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Ionicons name={tab.icon} size={20} color="#0095db" />
              </View>
              <Text style={s.rowLabel}>{tab.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </>
      )}

      <Text style={[s.sectionTitle, overflowTabs.length > 0 && { marginTop: 24 }]}>Account</Text>
      <TouchableOpacity style={[s.row, s.logoutRow]} onPress={handleLogout} activeOpacity={0.7}>
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
  container:    { flex: 1, backgroundColor: '#f1f5f9' },
  content:      { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 6,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  logoutRow: {},
  iconWrap:  { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  rowLabel:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },
});
