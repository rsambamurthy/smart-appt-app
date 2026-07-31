import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import type { VisitorEntry } from '../api/types';

export default function VisitorsScreen() {
  const [entries,    setEntries]    = useState<VisitorEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ data: VisitorEntry[] }>('/visitors');
      setEntries(res.data);
      setError(null);
    } catch (e: any) { setError(e?.message ?? 'Failed to load'); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={s.center}><ActivityIndicator color="#0095db" size="large" /></View>;

  return (
    <FlatList
      style={s.container}
      data={entries}
      keyExtractor={(v) => v.id}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
      ListEmptyComponent={<Text style={s.empty}>{error ?? 'No visitor records.'}</Text>}
      renderItem={({ item: v }) => (
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{v.visitor_name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name}>{v.visitor_name}</Text>
              <Text style={s.purpose}>{v.purpose}</Text>
              {v.host_unit && <Text style={s.unit}>Unit: {v.host_unit}</Text>}
            </View>
            <View style={[s.statusDot, { backgroundColor: v.checked_out_at ? '#94a3b8' : '#22c55e' }]} />
          </View>
          <View style={s.times}>
            <Ionicons name="enter-outline" size={12} color="#64748b" />
            <Text style={s.time}>{new Date(v.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
            {v.checked_out_at && (
              <>
                <Ionicons name="exit-outline" size={12} color="#94a3b8" />
                <Text style={[s.time, { color: '#94a3b8' }]}>{new Date(v.checked_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </>
            )}
            <Text style={s.dateStr}>{new Date(v.checked_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
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
  row:       { flexDirection: 'row', alignItems: 'center' },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0095db20', alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 18, fontWeight: '700', color: '#0095db' },
  name:      { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  purpose:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  unit:      { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  times:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  time:      { fontSize: 12, color: '#64748b', fontWeight: '600' },
  dateStr:   { fontSize: 11, color: '#94a3b8', marginLeft: 'auto' },
});
