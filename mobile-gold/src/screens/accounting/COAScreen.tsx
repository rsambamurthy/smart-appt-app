import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { api } from '../../api/client';
import SearchInput from '../../components/SearchInput';
import type { Account } from '../../api/types';

const PRIMARY = '#7C3AED';
const TYPE_COLOR: Record<string, string> = { ASSET: '#10b981', LIABILITY: '#ef4444', INCOME: '#0891b2', EXPENSE: '#f59e0b', EQUITY: '#7C3AED' };

export default function COAScreen() {
  const [accounts,   setAccounts]   = useState<Account[]>([]);
  const [filtered,   setFiltered]   = useState<Account[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Account[] }>('/accounting/accounts');
      const list = Array.isArray(res.data) ? res.data : [];
      setAccounts(list);
      setFiltered(list);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load accounts.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? accounts.filter(a => a.name.toLowerCase().includes(q) || a.code.includes(q)) : accounts);
  }, [search, accounts]);

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
      keyExtractor={a => a.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
      contentContainerStyle={s.list}
      ListHeaderComponent={
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search accounts…"
          suggestions={accounts.flatMap(a => [a.name, a.code].filter(Boolean) as string[])}
        />
      }
      ListEmptyComponent={<Text style={s.empty}>No accounts found.</Text>}
      renderItem={({ item }) => (
        <View style={[s.row, item.is_group && s.groupRow]}>
          <Text style={[s.code, { color: TYPE_COLOR[item.type] ?? '#6b7280' }]}>{item.code}</Text>
          <View style={s.info}>
            <Text style={[s.name, item.is_group && s.groupName]}>{item.name}</Text>
            <Text style={s.sub}>{item.type} · {item.sub_type}</Text>
          </View>
          {item.is_group && <View style={s.groupBadge}><Text style={s.groupBadgeText}>GROUP</Text></View>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:     { padding: 16, paddingBottom: 40 },
  empty:    { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  search:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  groupRow: { backgroundColor: '#F5F3FF' },
  code:     { fontFamily: 'monospace', fontWeight: '700', width: 56, fontSize: 13 },
  info:     { flex: 1 },
  name:     { color: '#0f172a', fontWeight: '500', fontSize: 14 },
  groupName: { fontWeight: '700' },
  sub:      { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  groupBadge: { backgroundColor: PRIMARY, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  groupBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
