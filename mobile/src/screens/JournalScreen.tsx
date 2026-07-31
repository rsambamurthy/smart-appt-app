import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import type { JournalEntry } from '../api/types';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

export default function JournalScreen() {
  const [entries,    setEntries]    = useState<JournalEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ data: JournalEntry[] }>('/accounting/journal');
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
      keyExtractor={(e) => e.id}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
      ListEmptyComponent={<Text style={s.empty}>{error ?? 'No journal entries.'}</Text>}
      renderItem={({ item: e }) => (
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.entryNo}>{e.entry_no}</Text>
            <Text style={s.date}>{new Date(e.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
          <Text style={s.desc} numberOfLines={2}>{e.description}</Text>
          <View style={s.amounts}>
            <View style={s.amtBlock}>
              <Text style={s.amtLabel}>Debit</Text>
              <Text style={[s.amt, { color: '#ef4444' }]}>{fmt(e.total_debit)}</Text>
            </View>
            <View style={s.amtBlock}>
              <Text style={s.amtLabel}>Credit</Text>
              <Text style={[s.amt, { color: '#22c55e' }]}>{fmt(e.total_credit)}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: e.status === 'POSTED' ? '#dcfce7' : '#fef9c3' }]}>
              <Text style={[s.statusText, { color: e.status === 'POSTED' ? '#16a34a' : '#ca8a04' }]}>{e.status}</Text>
            </View>
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
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  entryNo:     { fontSize: 13, fontWeight: '700', color: '#7c3aed' },
  date:        { fontSize: 12, color: '#64748b' },
  desc:        { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  amounts:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  amtBlock:    {},
  amtLabel:    { fontSize: 10, color: '#94a3b8', marginBottom: 2 },
  amt:         { fontSize: 14, fontWeight: '700' },
  statusBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText:  { fontSize: 10, fontWeight: '700' },
});
