import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { api } from '../../api/client';
import SearchInput from '../../components/SearchInput';
import type { Account, LedgerReport } from '../../api/types';

const PRIMARY = '#7C3AED';
const fmt = (n: unknown) => '₹' + Math.abs(Number(n ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function LedgerScreen() {
  const [accounts,   setAccounts]   = useState<Account[]>([]);
  const [selected,   setSelected]   = useState<Account | null>(null);
  const [report,     setReport]     = useState<LedgerReport | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  const loadAccounts = () => {
    setLoading(true); setError(null);
    api.get<{ data: Account[] }>('/accounting/accounts')
      .then(r => setAccounts((Array.isArray(r.data) ? r.data : []).filter(a => !a.is_group)))
      .catch((e: any) => setError(e?.message ?? 'Failed to load accounts.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAccounts(); }, []);

  const loadLedger = async (acct: Account, isRefresh = false) => {
    setSelected(acct);
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: LedgerReport }>(`/accounting/journal/ledger?account_id=${acct.id}`);
      setReport(res.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load ledger.');
      setReport(null);
    } finally { setLoading(false); setRefreshing(false); }
  };

  if (loading && !selected) return <View style={[s.center, { backgroundColor: '#f8fafc' }]}><ActivityIndicator color={PRIMARY} size="large" /></View>;

  if (error && !selected) return (
    <View style={[s.center, { backgroundColor: '#f8fafc', padding: 32 }]}>
      <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <TouchableOpacity onPress={loadAccounts} style={{ backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!selected) {
    const q = search.trim().toLowerCase();
    const shown = q
      ? accounts.filter(a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
      : accounts;
    return (
      <FlatList
        data={shown}
        keyExtractor={a => a.id}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Text style={s.pick}>Select an account</Text>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or code…"
              suggestions={accounts.flatMap(a => [a.name, a.code].filter(Boolean) as string[])}
            />
          </>
        }
        ListEmptyComponent={<Text style={s.empty}>{q ? 'No accounts match your search.' : 'No accounts found. Seed the Chart of Accounts from the web app first.'}</Text>}
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

  const rows = report?.rows ?? [];
  const side = (bal: number) => (report?.isDebitNormal ? (bal >= 0 ? 'DR' : 'CR') : (bal >= 0 ? 'CR' : 'DR'));

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={s.back} onPress={() => { setSelected(null); setReport(null); setError(null); }}>
        <Text style={s.backText}>← Back to accounts</Text>
      </TouchableOpacity>
      <View style={s.acctBanner}>
        <Text style={s.bannerCode}>{selected.code}</Text>
        <Text style={s.bannerName}>{selected.name}</Text>
      </View>
      {loading ? (
        <View style={[s.center, { backgroundColor: '#f8fafc' }]}><ActivityIndicator color={PRIMARY} /></View>
      ) : error ? (
        <View style={[s.center, { backgroundColor: '#f8fafc', padding: 32 }]}>
          <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => loadLedger(selected)} style={{ backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLedger(selected, true)} colors={[PRIMARY]} />}
          ListEmptyComponent={<Text style={s.empty}>No ledger entries for this account.</Text>}
          ListHeaderComponent={
            <>
              <View style={s.obCard}>
                <Text style={s.obLabel}>Opening Balance</Text>
                <Text style={s.obValue}>{fmt(report?.openingBalance)} {side(report?.openingBalance ?? 0)}</Text>
              </View>
              <View style={s.ledgerHeader}>
                <Text style={[s.col, { flex: 2 }]}>Date</Text>
                <Text style={[s.col, { flex: 1, textAlign: 'right' }]}>DR</Text>
                <Text style={[s.col, { flex: 1, textAlign: 'right' }]}>CR</Text>
                <Text style={[s.col, { flex: 1.3, textAlign: 'right' }]}>Balance</Text>
              </View>
            </>
          }
          ListFooterComponent={
            <View style={s.obCard}>
              <Text style={s.obLabel}>Closing Balance</Text>
              <Text style={s.obValue}>{fmt(report?.closingBalance)} {side(report?.closingBalance ?? 0)}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.ledgerRow}>
              <View style={{ flex: 2 }}>
                <Text style={s.cell}>{new Date(item.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                <Text style={s.ref} numberOfLines={1}>{item.reference_code}</Text>
              </View>
              <Text style={[s.cell, { flex: 1, textAlign: 'right', color: '#ef4444' }]}>{Number(item.debit) ? fmt(item.debit) : '-'}</Text>
              <Text style={[s.cell, { flex: 1, textAlign: 'right', color: '#10b981' }]}>{Number(item.credit) ? fmt(item.credit) : '-'}</Text>
              <Text style={[s.cell, { flex: 1.3, textAlign: 'right', fontWeight: '600' }]}>{fmt(item.balance)} {side(item.balance)}</Text>
            </View>
          )}
        />
      )}
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
  bannerName:  { color: 'rgba(255,255,255,0.9)', fontSize: 15, flex: 1 },
  obCard:      { backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12, marginBottom: 8, marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  obLabel:     { fontWeight: '700', color: '#5B21B6', fontSize: 13 },
  obValue:     { fontWeight: '700', color: '#1e1b4b', fontSize: 13 },
  ledgerHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  col:         { fontSize: 12, fontWeight: '700', color: '#64748b' },
  ledgerRow:   { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  cell:        { fontSize: 12.5, color: '#334155' },
  ref:         { fontSize: 10.5, color: '#94a3b8', marginTop: 1 },
});
