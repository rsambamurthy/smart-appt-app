import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '../api/client';
import type { Announcement } from '../api/types';

export default function AnnouncementsScreen() {
  const [items,      setItems]      = useState<Announcement[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ data: Announcement[] }>('/announcements');
      setItems(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load announcements');
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={s.center}><ActivityIndicator color="#0095db" size="large" /></View>;

  return (
    <FlatList
      style={s.container}
      data={items}
      keyExtractor={(a) => a.id}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
      ListEmptyComponent={<Text style={s.empty}>{error ?? 'No announcements yet.'}</Text>}
      renderItem={({ item: a }) => (
        <View style={s.card}>
          <View style={s.dotRow}>
            <View style={s.dot} />
            <Text style={s.date}>{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            {a.author && <Text style={s.author}> · {a.author.name}</Text>}
          </View>
          <Text style={s.title}>{a.title}</Text>
          <Text style={s.body} numberOfLines={4}>{a.body}</Text>
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
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  dotRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 8 },
  date:    { fontSize: 12, color: '#64748b' },
  author:  { fontSize: 12, color: '#94a3b8' },
  title:   { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  body:    { fontSize: 13, color: '#475569', lineHeight: 20 },
});
