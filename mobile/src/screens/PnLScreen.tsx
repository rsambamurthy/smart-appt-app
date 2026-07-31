import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { api } from '../api/client';
import type { PnLReport } from '../api/types';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

const CURRENT_FY = (() => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(-2)}`;
})();

export default function PnLScreen() {
  const [report,     setReport]     = useState<PnLReport | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fy,         setFy]         = useState(CURRENT_FY);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (financialYear = fy) => {
    try {
      const res = await api.get<{ data: PnLReport }>(`/accounting/pnl?fy=${financialYear}`);
      setReport(res.data);
      setError(null);
    } catch (e: any) { setError(e?.message ?? 'Failed to load P&L'); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, [fy]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalIncome   = report?.income.reduce((s, r) => s + r.amount, 0)   ?? 0;
  const totalExpenses = report?.expenses.reduce((s, r) => s + r.amount, 0) ?? 0;

  if (loading) return <View style={s.center}><ActivityIndicator color="#0095db" size="large" /></View>;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0095db']} />}
    >
      {/* FY picker */}
      <View style={s.fyRow}>
        {['2024-25', '2025-26', '2026-27'].map((y) => (
          <TouchableOpacity
            key={y}
            style={[s.fyBtn, fy === y && s.fyActive]}
            onPress={() => setFy(y)}
          >
            <Text style={[s.fyText, fy === y && s.fyActiveText]}>FY {y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text style={s.error}>{error}</Text>
      ) : report ? (
        <>
          {/* Summary cards */}
          <View style={s.summaryRow}>
            <SummaryCard label="Total Income"   value={fmt(totalIncome)}              color="#22c55e" />
            <SummaryCard label="Total Expenses" value={fmt(totalExpenses)}            color="#ef4444" />
            <SummaryCard label="Net Surplus"    value={fmt(report.net_surplus)}       color={report.net_surplus >= 0 ? '#0095db' : '#ef4444'} />
          </View>

          {/* Income section */}
          <Section title="Income" color="#22c55e">
            {report.income.map((r, i) => (
              <LineRow key={i} label={r.account} value={fmt(r.amount)} valueColor="#22c55e" />
            ))}
            <LineRow label="Total Income" value={fmt(totalIncome)} valueColor="#16a34a" bold />
          </Section>

          {/* Expenses section */}
          <Section title="Expenses" color="#ef4444">
            {report.expenses.map((r, i) => (
              <LineRow key={i} label={r.account} value={fmt(r.amount)} valueColor="#ef4444" />
            ))}
            <LineRow label="Total Expenses" value={fmt(totalExpenses)} valueColor="#dc2626" bold />
          </Section>

          {/* Net */}
          <View style={[s.netCard, { borderColor: report.net_surplus >= 0 ? '#22c55e' : '#ef4444' }]}>
            <Text style={s.netLabel}>Net Surplus / (Deficit)</Text>
            <Text style={[s.netValue, { color: report.net_surplus >= 0 ? '#16a34a' : '#dc2626' }]}>
              {report.net_surplus < 0 ? '(' : ''}{fmt(Math.abs(report.net_surplus))}{report.net_surplus < 0 ? ')' : ''}
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <View style={sec.container}>
      <Text style={[sec.title, { color }]}>{title}</Text>
      {children}
    </View>
  );
}
function LineRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor: string; bold?: boolean }) {
  return (
    <View style={sec.row}>
      <Text style={[sec.label, bold && sec.bold]}>{label}</Text>
      <Text style={[sec.value, { color: valueColor }, bold && sec.bold]}>{value}</Text>
    </View>
  );
}
function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[sum.card, { borderTopColor: color }]}>
      <Text style={[sum.value, { color }]}>{value}</Text>
      <Text style={sum.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:   { padding: 16, paddingBottom: 32 },
  error:     { textAlign: 'center', color: '#ef4444', marginTop: 40, fontSize: 14 },
  fyRow:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  fyBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  fyActive:  { backgroundColor: '#0095db', borderColor: '#0095db' },
  fyText:    { fontSize: 12, fontWeight: '600', color: '#475569' },
  fyActiveText: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  netCard:   { borderWidth: 2, borderRadius: 12, padding: 16, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  netLabel:  { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  netValue:  { fontSize: 18, fontWeight: '800' },
});
const sec = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  title:     { fontSize: 13, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label:     { fontSize: 13, color: '#475569', flex: 1 },
  value:     { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  bold:      { fontWeight: '800', color: '#0f172a' },
});
const sum = StyleSheet.create({
  card:  { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, borderTopWidth: 3, alignItems: 'center' },
  value: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  label: { fontSize: 10, color: '#64748b', marginTop: 2, textAlign: 'center' },
});
