import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { api } from '../../api/client';
import type { Announcement } from '../../api/types';

const PRIMARY = '#7C3AED';

export default function AnnouncementsScreen() {
  const [items,      setItems]      = useState<Announcement[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Announcement[] }>('/announcements?limit=50');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load announcements.');
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
      data={items}
      keyExtractor={a => a.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
      contentContainerStyle={s.list}
      ListEmptyComponent={<Text style={s.empty}>No announcements.</Text>}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.date}>{new Date(item.published_at ?? item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          </View>
          <Text style={s.body}>{item.body}</Text>
          {item.poster && <Text style={s.author}>— {item.poster.name}</Text>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:   { padding: 16, paddingBottom: 40 },
  empty:  { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2, borderLeftWidth: 4, borderLeftColor: PRIMARY },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title:  { fontWeight: '700', color: '#0f172a', fontSize: 15, flex: 1, marginRight: 8 },
  date:   { color: '#94a3b8', fontSize: 12 },
  body:   { color: '#475569', fontSize: 14, lineHeight: 20 },
  author: { color: '#94a3b8', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
});
