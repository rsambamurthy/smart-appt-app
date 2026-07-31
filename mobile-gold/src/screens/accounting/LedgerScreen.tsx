import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { api } from '../../api/client';
import type { Account, LedgerLine } from '../../api/types';

const PRIMARY = '#7C3AED';
function fmt(n: number) { return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

export default function LedgerScreen() {
  const [accounts,   setAccounts]   = useState<Account[]>([]);
  const [selected,   setSelected]   = useState<Account | null>(null);
  const [lines,      setLines]      = useState<LedgerLine[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Account[] }>('/accounting/accounts')
      .then(r => setAccounts((r.data ?? []).filter(a => !a.is_group)))
      .catch((e: any) => setError(e?.message ?? 'Failed to load accounts.'))
      .finally(() => setLoading(false));
  }, []);

  const loadLedger = async (acct: Account) => {
    setSelected(acct); setLoading(true); setError(null);
    try {
      const res = await api.get<{ data: LedgerLine[] }>(`/accounting/journal/ledger?account_id=${acct.id}`);
      setLines(res.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load ledger.');
    } finally { setLoading(false); }
  };

  if (loading && !selected) return <View style={[s.center, { backgroundColor: '#f8fafc' }]}><ActivityIndicator color={PRIMARY} size="large" /></View>;

  if (error && !selected) return (
    <View style={[s.center, { backgroundColor: '#f8fafc', padding: 32 }]}>
      <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <TouchableOpacity onPress={() => { setError(null); setLoading(true); api.get<{ data: Account[] }>('/accounting/accounts').then(r => setAccounts((r.data ?? []).filter(a => !a.is_group))).catch((e: any) => setError(e?.message ?? 'Failed.')).finally(() => setLoading(false)); }} style={{ backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!selected) {
    return (
      <FlatList
        data={accounts}
        keyExtractor={a => a.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.pick}>Select an account</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.acctRow} onPress={() => loadLedger(item)}>
            <Text style={s.acctCode}>{item.code}</Text>
            <Text style={s.acctName}>{item.name}</Text>
            <Text style={s.acctType}>{item.type}</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={s.back} onPress={() => setSelected(null)}>
        <Text style={s.backText}>← Back to accounts</Text>
      </TouchableOpacity>
      <View style={s.acctBanner}>
        <Text style={s.bannerCode}>{selected.code}</Text>
        <Text style={s.bannerName}>{selected.name}</Text>
      </View>
      {loading
        ? <View style={[s.center, { backgroundColor: '#f8fafc' }]}><ActivityIndicator color={PRIMARY} /></View>
        : (
          <FlatList
            data={lines}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLedger(selected)} colors={[PRIMARY]} />}
            ListEmptyComponent={<Text style={s.empty}>No ledger entries.</Text>}
            ListHeaderComponent={
              <View style={s.ledgerHeader}>
                <Text style={[s.col, { flex: 2 }]}>Date</Text>
                <Text style={[s.col, { flex: 1, textAlign: 'right' }]}>DR</Text>
                <Text style={[s.col, { flex: 1, textAlign: 'right' }]}>CR</Text>
                <Text style={[s.col, { flex: 1, textAlign: 'right' }]}>Balance</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={s.ledgerRow}>
                <Text style={[s.cell, { flex: 2 }]}>{new Date(item.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                <Text style={[s.cell, { flex: 1, textAlign: 'right', color: '#ef4444' }]}>{item.debit ? fmt(item.debit) : '-'}</Text>
                <Text style={[s.cell, { flex: 1, textAlign: 'right', color: '#10b981' }]}>{item.credit ? fmt(item.credit) : '-'}</Text>
                <Text style={[s.cell, { flex: 1, textAlign: 'right', fontWeight: '600' }]}>{fmt(item.balance)} {item.running_side}</Text>
              </View>
            )}
          />
        )
      }
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { padding: 16, paddingBottom: 40 },
  empty:       { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  pick:        { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  acctRow:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 1 },
  acctCode:    { fontFamily: 'monospace', color: PRIMARY, fontWeight: '700', width: 60 },
  acctName:    { flex: 1, color: '#0f172a', fontWeight: '500' },
  acctType:    { color: '#9ca3af', fontSize: 12 },
  back:        { padding: 16, paddingBottom: 8 },
  backText:    { color: PRIMARY, fontWeight: '600' },
  acctBanner:  { backgroundColor: PRIMARY, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  bannerCode:  { color: '#fff', fontWeight: '800', fontSize: 16 },
  bannerName:  { color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  ledgerHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  col:         { fontSize: 12, fontWeight: '700', color: '#64748b' },
  ledgerRow:   { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  cell:        { fontSize: 13, color: '#334155' },
});
