import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import type { FYClosure } from '../../api/types';

const PRIMARY = '#7C3AED';

export default function FYClosureScreen() {
  const [closures,   setClosures]   = useState<FYClosure[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing,    setClosing]    = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: FYClosure[] }>('/accounting/fy/list');
      setClosures(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load FY closures.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleClose = (fy: string) => {
    Alert.alert('Close FY', `Are you sure you want to close FY ${fy}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close FY', style: 'destructive', onPress: async () => {
        setClosing(true);
        try {
          await api.post('/accounting/fy/close', { fy });
          await load();
          Alert.alert('Success', `FY ${fy} has been closed.`);
        } catch (err: any) {
          Alert.alert('Error', err?.message ?? 'Failed to close FY.');
        } finally { setClosing(false); }
      }},
    ]);
  };

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
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}>
      {closures.length === 0 && <Text style={s.empty}>No FY closures found.</Text>}
      {closures.map(c => (
        <View key={c.id} style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.fy}>FY {c.fy}</Text>
            <View style={[s.badge, { backgroundColor: c.status === 'CLOSED' ? '#10b981' : '#f59e0b' }]}>
              <Text style={s.badgeText}>{c.status}</Text>
            </View>
          </View>
          {c.status === 'CLOSED' ? (
            <View style={s.closedInfo}>
              <Ionicons name="lock-closed" size={16} color="#10b981" />
              <Text style={s.closedText}>Closed on {c.closed_at ? new Date(c.closed_at).toLocaleDateString('en-IN') : '—'}</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.closeBtn} onPress={() => handleClose(c.fy)} disabled={closing}>
              {closing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.closeBtnText}>Close this FY</Text>}
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container:  { flex: 1, backgroundColor: '#f8fafc' },
  content:    { padding: 16, paddingBottom: 40 },
  empty:      { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fy:         { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  closedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closedText: { color: '#10b981', fontWeight: '600' },
  closeBtn:   { backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
