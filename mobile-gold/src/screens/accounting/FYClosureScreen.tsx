import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import type { FYInfo } from '../../api/types';

const PRIMARY = '#7C3AED';
const fmt = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function FYClosureScreen() {
  const [fys,        setFys]        = useState<FYInfo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: FYInfo[] }>('/accounting/fy/list');
      setFys(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load financial years.');
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
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}>
      {fys.length === 0 && <Text style={s.empty}>No financial years found.</Text>}
      {fys.map(f => (
        <View key={f.financial_year} style={s.card}>
          <View style={s.cardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.fy}>FY {f.financial_year}</Text>
              {f.is_current && <View style={s.currentBadge}><Text style={s.currentBadgeText}>CURRENT</Text></View>}
            </View>
            <View style={[s.badge, { backgroundColor: f.is_closed ? '#10b981' : '#f59e0b' }]}>
              <Text style={s.badgeText}>{f.status}</Text>
            </View>
          </View>
          {f.is_closed ? (
            <View style={s.closedInfo}>
              <Ionicons name="lock-closed" size={16} color="#10b981" />
              <Text style={s.closedText}>
                Closed {f.closed_at ? 'on ' + new Date(f.closed_at).toLocaleDateString('en-IN') : ''}
                {f.closed_by ? ' by ' + f.closed_by : ''}
              </Text>
            </View>
          ) : (
            <Text style={s.openText}>Year is open. Close it from the web app (requires choosing a surplus account).</Text>
          )}
          {f.net_surplus != null && (
            <Text style={s.surplus}>Net surplus: {fmt(f.net_surplus)}</Text>
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
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fy:         { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  currentBadge: { backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  currentBadgeText: { color: PRIMARY, fontSize: 10, fontWeight: '700' },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  closedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closedText: { color: '#10b981', fontWeight: '600', fontSize: 13, flex: 1 },
  openText:   { color: '#64748b', fontSize: 13 },
  surplus:    { color: '#475569', fontSize: 13, fontWeight: '600', marginTop: 8 },
});
