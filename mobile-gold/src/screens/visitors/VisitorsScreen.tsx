import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import type { VisitorEntry } from '../../api/types';

const PRIMARY = '#7C3AED';
const unitLabel = (v: VisitorEntry) => v.unit ? `${v.unit.block ? v.unit.block + '-' : ''}${v.unit.flat_number}` : '—';
const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function VisitorsScreen() {
  const [entries,    setEntries]    = useState<VisitorEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: VisitorEntry[] }>('/visitors/log?limit=50');
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load visitor log.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <View style={[s.center, { backgroundColor: '#f8fafc' }]}><ActivityIndicator color={PRIMARY} size="large" /></View>;

  if (error) return (
    <View style={[s.center, { backgroundColor: '#f8fafc', padding: 32 }]}>
      <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <TouchableOpacity onPress={() => load()} style={{ backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={entries}
      keyExtractor={e => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
      contentContainerStyle={s.list}
      ListEmptyComponent={<Text style={s.empty}>No visitor entries.</Text>}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <Ionicons name="person-circle-outline" size={36} color={PRIMARY} />
            <View style={s.info}>
              <Text style={s.name}>{item.visitor_name}</Text>
              <Text style={s.unit}>Unit {unitLabel(item)}</Text>
              {item.vehicle_number && <Text style={s.vehicle}>{item.vehicle_number}</Text>}
            </View>
            <View style={[s.badge, { backgroundColor: item.exited_at ? '#10b981' : item.entered_at ? '#f59e0b' : '#6b7280' }]}>
              <Text style={s.badgeText}>{item.exited_at ? 'OUT' : item.entered_at ? 'IN' : item.status}</Text>
            </View>
          </View>
          <View style={s.times}>
            <Text style={s.time}>In: {fmtTime(item.entered_at)}</Text>
            {item.exited_at && <Text style={s.time}>Out: {fmtTime(item.exited_at)}</Text>}
          </View>
          {item.purpose && <Text style={s.purpose}>{item.purpose}</Text>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, paddingBottom: 40 },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  info:      { flex: 1 },
  name:      { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  unit:      { color: '#64748b', fontSize: 13 },
  vehicle:   { color: PRIMARY, fontSize: 12, fontWeight: '600' },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  times:     { flexDirection: 'row', gap: 16 },
  time:      { color: '#475569', fontSize: 13 },
  purpose:   { color: '#94a3b8', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
});
