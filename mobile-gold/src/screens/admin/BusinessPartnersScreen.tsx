import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { api } from '../../api/client';
import SearchInput from '../../components/SearchInput';
import type { BusinessPartner } from '../../api/types';

const PRIMARY = '#7C3AED';
const CAT_COLOR: Record<string, string> = { BANK: '#0891b2', VENDOR: '#f59e0b', UNIT: '#10b981' };

export default function BusinessPartnersScreen() {
  const [partners,   setPartners]   = useState<BusinessPartner[]>([]);
  const [category,   setCategory]   = useState<'ALL' | 'BANK' | 'VENDOR' | 'UNIT'>('ALL');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error,  setError]  = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: BusinessPartner[] }>('/accounting/bp-masters?limit=200');
      setPartners(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load business partners.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = partners
    .filter(p => category === 'ALL' || p.bp_category === category)
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q));
  const CATS = ['ALL', 'BANK', 'VENDOR', 'UNIT'] as const;

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
      data={filtered}
      keyExtractor={p => p.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
      contentContainerStyle={s.list}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={s.empty}>No business partners found.</Text>}
      ListHeaderComponent={
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search partners by name or code…"
            suggestions={partners.flatMap(p => [p.name, p.code].filter(Boolean) as string[])}
          />
          <View style={s.catRow}>
            {CATS.map(c => (
              <TouchableOpacity key={c} style={[s.catChip, category === c && s.catActive]} onPress={() => setCategory(c)}>
                <Text style={[s.catText, category === c && s.catActiveText]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.name}>{item.name}</Text>
            <View style={[s.badge, { backgroundColor: CAT_COLOR[item.bp_category] ?? '#6b7280' }]}>
              <Text style={s.badgeText}>{item.bp_category}</Text>
            </View>
          </View>
          {item.bp_type && <Text style={s.type}>{item.bp_type.name}</Text>}
          {item.phone && <Text style={s.contact}>{item.phone}</Text>}
          {item.email && <Text style={s.contact}>{item.email}</Text>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:         { padding: 16, paddingBottom: 40 },
  empty:        { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  catRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  catChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  catActive:    { backgroundColor: PRIMARY },
  catText:      { fontSize: 13, fontWeight: '600', color: '#64748b' },
  catActiveText: { color: '#fff' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name:         { fontWeight: '700', color: '#0f172a', fontSize: 15, flex: 1, marginRight: 8 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  type:         { color: '#64748b', fontSize: 13, marginBottom: 4 },
  contact:      { color: '#94a3b8', fontSize: 12 },
});
