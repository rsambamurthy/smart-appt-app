import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity,
} from 'react-native';
import { api } from '../api/client';
import type { LedgerLine } from '../api/types';

function fmt(n: number) { return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

interface Account { id: string; code: string; name: string; }

export default function LedgerScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search,     setSearch]     = useState('');
  const [lines,      setLines]      = useState<LedgerLine[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [accsLoading,setAccsLoading]= useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load account list
  useEffect(() => {
    api.get<{ data: Account[] }>('/accounting/accounts')
      .then((r) => setAccounts(r.data))
      .catch(() => {})
      .finally(() => setAccsLoading(false));
  }, []);

  const loadLedger = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: LedgerLine[] }>(`/accounting/ledger/${id}`);
      setLines(res.data);
    } catch { setLines([]); }
    finally { setLoading(false); }
  };

  const onSelect = (id: string) => { setSelectedId(id); setSearch(''); loadLedger(id); };
  const onRefresh = async () => { setRefreshing(true); await loadLedger(selectedId); setRefreshing(false); };

  const filteredAccounts = accounts.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)
  );

  const balance = lines.length > 0 ? lines[lines.length - 1].balance : 0;

  if (accsLoading) return <View style={s.center}><ActivityIndicator color="#0095db" size="large" /></View>;

  return (
    <View style={s.container}>
      {/* Account selector */}
      {!selectedId ? (
        <View style={s.picker}>
          <Text style={s.pickTitle}>Select an Account</Text>
          <TextInput
            style={s.search}
            placeholder="Search account…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filteredAccounts}
            keyExtractor={(a) => a.id}
            renderItem={({ item: a }) => (
              <TouchableOpacity style={s.acctRow} onPress={() => onSelect(a.id)}>
                <Text style={s.acctCode}>{a.code}</Text>
                <Text style={s.acctName}>{a.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <>
          {/* Back + balance header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => { setSelectedId(''); setLines([]); }}>
              <Text style={s.back}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.acctLabel}>{accounts.find((a) => a.id === selectedId)?.name}</Text>
            <Text style={[s.balance, { color: balance >= 0 ? '#16a34a' : '#ef4444' }]}>
              {balance >= 0 ? 'Dr ' : 'Cr '}{fmt(balance)}
            </Text>
          </View>

          {loading ? (
            <View style={s.center}><ActivityIndicator color="#0095db" size="large" /></View>
          ) : (
            <>
              {/* Column headers */}
              <View style={s.colRow}>
                <Text style={[s.col, { flex: 2 }]}>Date / Desc</Text>
                <Text style={[s.col, s.right]}>Dr</Text>
                <Text style={[s.col, s.right]}>Cr</Text>
                <Text style={[s.col, s.right]}>Balance</Text>
              </View>
              <FlatList
                data={lines}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={s.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
                ListEmptyComponent={<Text style={s.empty}>No transactions.</Text>}
                renderItem={({ item: l }) => (
                  <View style={s.lineRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={s.lineDate}>{new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                      <Text style={s.lineDesc} numberOfLines={1}>{l.description}</Text>
                    </View>
                    <Text style={[s.lineAmt, { color: l.debit  > 0 ? '#ef4444' : '#d1d5db' }]}>{l.debit  > 0 ? fmt(l.debit)  : '—'}</Text>
                    <Text style={[s.lineAmt, { color: l.credit > 0 ? '#16a34a' : '#d1d5db' }]}>{l.credit > 0 ? fmt(l.credit) : '—'}</Text>
                    <Text style={[s.lineAmt, { color: l.balance >= 0 ? '#0f172a' : '#ef4444' }]}>{fmt(l.balance)}</Text>
                  </View>
                )}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  picker:    { flex: 1, padding: 16 },
  pickTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  search:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#fff', marginBottom: 12, color: '#0f172a' },
  acctRow:   { flexDirection: 'row', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 6, alignItems: 'center' },
  acctCode:  { fontSize: 12, fontWeight: '700', color: '#7c3aed', width: 60 },
  acctName:  { fontSize: 14, color: '#0f172a', flex: 1 },
  header:    { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  back:      { fontSize: 13, color: '#0095db', fontWeight: '600', marginBottom: 4 },
  acctLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  balance:   { fontSize: 14, fontWeight: '700', marginTop: 2 },
  colRow:    { flexDirection: 'row', backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6 },
  col:       { fontSize: 11, fontWeight: '700', color: '#64748b', flex: 1 },
  right:     { textAlign: 'right' },
  list:      { paddingBottom: 32 },
  empty:     { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 },
  lineRow:   { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  lineDate:  { fontSize: 11, color: '#64748b' },
  lineDesc:  { fontSize: 12, color: '#0f172a', fontWeight: '500' },
  lineAmt:   { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
