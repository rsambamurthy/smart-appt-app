import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { api } from '../../api/client';
import SearchInput from '../../components/SearchInput';
import type { Bill } from '../../api/types';

const PRIMARY = '#7C3AED';
const STATUS_COLOR: Record<string, string> = { PAID: '#10b981', UNPAID: '#f59e0b', PARTIAL: '#0891b2', WAIVED: '#6b7280' };
const fmt = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const unitLabel = (b: Bill) => b.unit ? `${b.unit.block ? b.unit.block + '-' : ''}${b.unit.flat_number}` : '—';
const billTitle = (b: Bill) => b.bill_label ?? `${MONTHS[(b.period_month - 1) % 12]} ${b.period_year}`;

export default function BillsScreen() {
  const [bills,      setBills]      = useState<Bill[]>([]);
  const [filtered,   setFiltered]   = useState<Bill[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Bill[] }>('/dues/bills?limit=100');
      const list = Array.isArray(res.data) ? res.data : [];
      setBills(list); setFiltered(list);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load bills.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? bills.filter(b => unitLabel(b).toLowerCase().includes(q) || billTitle(b).toLowerCase().includes(q)) : bills);
  }, [search, bills]);

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
      keyExtractor={b => b.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
      contentContainerStyle={s.list}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={s.empty}>No bills found.</Text>}
      ListHeaderComponent={
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search unit or period…"
          suggestions={bills.flatMap(b => [unitLabel(b), billTitle(b)].filter(Boolean) as string[])}
        />
      }
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <View>
              <Text style={s.unit}>Unit {unitLabel(item)}</Text>
              <Text style={s.owner}>{billTitle(item)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] ?? '#6b7280' }]}>
              <Text style={s.badgeText}>{item.status}</Text>
            </View>
          </View>
          <View style={s.cardBottom}>
            <Text style={s.amount}>{fmt(item.total_amount)}</Text>
            <Text style={s.due}>Due: {new Date(item.due_date).toLocaleDateString('en-IN')}</Text>
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, paddingBottom: 40 },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  search:    { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  unit:      { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  owner:     { color: '#64748b', fontSize: 13 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount:    { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  due:       { color: '#94a3b8', fontSize: 12 },
});
