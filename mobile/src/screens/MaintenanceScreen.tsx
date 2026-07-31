import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import type { MaintenanceTicket } from '../api/types';

const STATUS_COLOR: Record<string, string> = {
  OPEN:        '#ef4444',
  IN_PROGRESS: '#f59e0b',
  RESOLVED:    '#22c55e',
  CLOSED:      '#94a3b8',
};
const PRIORITY_COLOR: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' };

export default function MaintenanceScreen() {
  const [tickets,    setTickets]    = useState<MaintenanceTicket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ data: MaintenanceTicket[] }>('/maintenance');
      setTickets(res.data);
      setError(null);
    } catch (e: any) { setError(e?.message ?? 'Failed to load'); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={s.center}><ActivityIndicator color="#0095db" size="large" /></View>;

  return (
    <FlatList
      style={s.container}
      data={tickets}
      keyExtractor={(t) => t.id}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
      ListEmptyComponent={<Text style={s.empty}>{error ?? 'No service requests.'}</Text>}
      renderItem={({ item: t }) => (
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.title} numberOfLines={1}>{t.title}</Text>
            <View style={[s.badge, { backgroundColor: STATUS_COLOR[t.status] + '20' }]}>
              <Text style={[s.badgeText, { color: STATUS_COLOR[t.status] }]}>{t.status.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={s.desc} numberOfLines={2}>{t.description}</Text>
          <View style={s.footer}>
            <Ionicons name="flag-outline" size={12} color={PRIORITY_COLOR[t.priority]} />
            <Text style={[s.priority, { color: PRIORITY_COLOR[t.priority] }]}>{t.priority}</Text>
            <Text style={s.date}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, paddingBottom: 32 },
  empty:     { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:     { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a', marginRight: 8 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  desc:      { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  footer:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priority:  { fontSize: 11, fontWeight: '600', marginRight: 8 },
  date:      { fontSize: 11, color: '#94a3b8', marginLeft: 'auto' },
});
