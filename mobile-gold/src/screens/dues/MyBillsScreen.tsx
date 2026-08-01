import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { api } from '../../api/client';
import type { Bill } from '../../api/types';

const PRIMARY = '#7C3AED';
const STATUS_COLOR: Record<string, string> = { PAID: '#10b981', UNPAID: '#f59e0b', PARTIAL: '#0891b2', WAIVED: '#6b7280' };
const fmt = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const billTitle = (b: Bill) => b.bill_label ?? `${MONTHS[(b.period_month - 1) % 12]} ${b.period_year} Maintenance`;

export default function MyBillsScreen() {
  const [bills,      setBills]      = useState<Bill[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Bill[] }>('/dues/bills/my?limit=100');
      setBills(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load bills.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const outstanding = bills.filter(b => b.status !== 'PAID' && b.status !== 'WAIVED').reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);
  const paid        = bills.filter(b => b.status === 'PAID').reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);

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
      data={bills}
      keyExtractor={b => b.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
      contentContainerStyle={s.list}
      ListEmptyComponent={<Text style={s.empty}>No bills found.</Text>}
      ListHeaderComponent={
        <View style={s.summary}>
          <View style={s.summaryItem}><Text style={s.summaryAmt}>{fmt(outstanding)}</Text><Text style={s.summaryLabel}>Outstanding</Text></View>
          <View style={s.divider} />
          <View style={s.summaryItem}><Text style={[s.summaryAmt, { color: '#10b981' }]}>{fmt(paid)}</Text><Text style={s.summaryLabel}>Paid</Text></View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.billNo}>{billTitle(item)}</Text>
            <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] ?? '#6b7280' }]}>
              <Text style={s.badgeText}>{item.status}</Text>
            </View>
          </View>
          {Number(item.penalty) > 0 && <Text style={s.desc}>Includes penalty {fmt(item.penalty)}</Text>}
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
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { padding: 16, paddingBottom: 40 },
  empty:       { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  summary:     { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryAmt:  { fontSize: 18, fontWeight: '800', color: '#f59e0b' },
  summaryLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  divider:     { width: 1, height: 36, backgroundColor: '#e2e8f0' },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  billNo:      { fontWeight: '700', color: '#0f172a', flex: 1 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  desc:        { color: '#64748b', fontSize: 13, marginBottom: 8 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount:      { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  due:         { color: '#94a3b8', fontSize: 12 },
});
