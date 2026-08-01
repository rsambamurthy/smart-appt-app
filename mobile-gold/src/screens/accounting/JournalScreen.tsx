import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { api } from '../../api/client';
import type { JournalEntry } from '../../api/types';

const PRIMARY = '#7C3AED';

const fmt = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const VT_COLOR: Record<string, string> = { BPV: '#10b981', CPV: '#ef4444', JV: '#7C3AED', SV: '#f59e0b', CV: '#0891b2', BV: '#6366f1', RV: '#10b981', PV: '#ef4444' };

/** Sum debit/credit across lines — backend has no total fields. */
function totals(e: JournalEntry) {
  let dr = 0, cr = 0;
  for (const l of e.lines ?? []) {
    dr += Number(l.debit ?? 0);
    cr += Number(l.credit ?? 0);
  }
  return { dr, cr };
}

export default function JournalScreen() {
  const [entries,    setEntries]    = useState<JournalEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: JournalEntry[] }>('/accounting/journal?limit=50');
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load journal entries.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
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
      ListEmptyComponent={<Text style={s.empty}>No journal entries found.</Text>}
      renderItem={({ item }) => {
        const t = totals(item);
        return (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.vtBadge, { backgroundColor: VT_COLOR[item.voucher_type] ?? '#6b7280' }]}>
                <Text style={s.vtText}>{item.voucher_type}</Text>
              </View>
              <Text style={s.voucher}>{item.reference_code}</Text>
              <Text style={s.date}>{fmtDate(item.entry_date)}</Text>
            </View>
            {item.narration ? <Text style={s.narration}>{item.narration}</Text> : null}
            <View style={s.amounts}>
              <Text style={s.dr}>DR  {fmt(t.dr)}</Text>
              <Text style={s.cr}>CR  {fmt(t.cr)}</Text>
            </View>
            <Text style={s.lines}>{item.lines?.length ?? 0} line{(item.lines?.length ?? 0) !== 1 ? 's' : ''} · {item.status}</Text>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, paddingBottom: 40 },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  vtBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vtText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  voucher:   { fontWeight: '700', color: '#0f172a', flex: 1, fontSize: 13 },
  date:      { color: '#64748b', fontSize: 12 },
  narration: { color: '#475569', fontSize: 13, marginBottom: 8 },
  amounts:   { flexDirection: 'row', gap: 16 },
  dr:        { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  cr:        { color: '#10b981', fontWeight: '600', fontSize: 13 },
  lines:     { color: '#94a3b8', fontSize: 12, marginTop: 6 },
});
