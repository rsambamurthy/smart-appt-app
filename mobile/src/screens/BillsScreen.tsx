import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import type { Bill } from '../api/types';

const STATUS_COLORS: Record<string, string> = {
  PAID:    '#22c55e',
  PENDING: '#f59e0b',
  OVERDUE: '#ef4444',
  PARTIAL: '#0891b2',
};

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function BillsScreen() {
  const [bills,     setBills]     = useState<Bill[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ data: Bill[] }>('/dues/my-bills');
      setBills(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load bills');
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const summary = {
    outstanding: bills.filter((b) => b.status !== 'PAID').reduce((s, b) => s + b.amount + b.penalty, 0),
    paid:        bills.filter((b) => b.status === 'PAID').length,
    pending:     bills.filter((b) => b.status !== 'PAID').length,
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0095db" size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* Summary banner */}
      <View style={styles.banner}>
        <SumCard label="Outstanding" value={fmt(summary.outstanding)} color="#ef4444" />
        <SumCard label="Paid Bills"  value={String(summary.paid)}     color="#22c55e" />
        <SumCard label="Pending"     value={String(summary.pending)}   color="#f59e0b" />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
        ListEmptyComponent={<Text style={styles.empty}>No bills found.</Text>}
        renderItem={({ item: b }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.billNo}>{b.bill_no}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[b.status] + '20' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[b.status] }]}>{b.status}</Text>
              </View>
            </View>
            <Text style={styles.period}>{b.period}</Text>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.amtLabel}>Amount</Text>
                <Text style={styles.amt}>{fmt(b.amount)}</Text>
              </View>
              {b.penalty > 0 && (
                <View>
                  <Text style={styles.amtLabel}>Penalty</Text>
                  <Text style={[styles.amt, { color: '#ef4444' }]}>{fmt(b.penalty)}</Text>
                </View>
              )}
              <View>
                <Text style={styles.amtLabel}>Due</Text>
                <Text style={styles.dueDate}>{new Date(b.due_date).toLocaleDateString('en-IN')}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function SumCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[sumStyles.card, { borderTopColor: color }]}>
      <Text style={[sumStyles.value, { color }]}>{value}</Text>
      <Text style={sumStyles.label}>{label}</Text>
    </View>
  );
}

const sumStyles = StyleSheet.create({
  card:  { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  value: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 11, color: '#64748b', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner:    { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  list:      { padding: 16, paddingTop: 8, paddingBottom: 32 },
  empty:     { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 },
  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 6, margin: 16, padding: 12, backgroundColor: '#fef2f2', borderRadius: 8 },
  errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  billNo:    { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  period:    { fontSize: 12, color: '#64748b', marginBottom: 10 },
  amtLabel:  { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  amt:       { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  dueDate:   { fontSize: 13, fontWeight: '600', color: '#475569' },
});
