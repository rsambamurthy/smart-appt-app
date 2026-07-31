import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { api } from '../api/client';
import type { BalanceSheetReport } from '../api/types';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

const CURRENT_FY = (() => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(-2)}`;
})();

export default function BalanceSheetScreen() {
  const [report,     setReport]     = useState<BalanceSheetReport | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fy,         setFy]         = useState(CURRENT_FY);
  const [error,      setError]      = useState<string | null>(null);

  const load = async (financialYear = fy) => {
    try {
      const res = await api.get<{ data: BalanceSheetReport }>(`/accounting/balance-sheet?fy=${financialYear}`);
      setReport(res.data);
      setError(null);
    } catch (e: any) { setError(e?.message ?? 'Failed to load Balance Sheet'); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, [fy]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalAssets      = report?.assets.reduce((s, r) => s + r.amount, 0)      ?? 0;
  const totalLiabilities = report?.liabilities.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalEquity      = report?.equity.reduce((s, r) => s + r.amount, 0)      ?? 0;
  const balanced         = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

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
          <TouchableOpacity key={y} style={[s.fyBtn, fy === y && s.fyActive]} onPress={() => setFy(y)}>
            <Text style={[s.fyText, fy === y && s.fyActiveText]}>FY {y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text style={s.error}>{error}</Text>
      ) : report ? (
        <>
          {/* Balance check banner */}
          <View style={[s.checkBanner, { backgroundColor: balanced ? '#dcfce7' : '#fef2f2' }]}>
            <Text style={[s.checkText, { color: balanced ? '#16a34a' : '#dc2626' }]}>
              {balanced ? '✓ Balance Sheet is balanced' : '⚠ Balance Sheet does not balance'}
            </Text>
          </View>

          <BSSection title="Assets" color="#0095db" rows={report.assets} total={totalAssets} />
          <BSSection title="Liabilities" color="#ef4444" rows={report.liabilities} total={totalLiabilities} />
          <BSSection title="Equity / Reserves" color="#7c3aed" rows={report.equity} total={totalEquity} />

          {/* Totals row */}
          <View style={s.totalsCard}>
            <TotalRow label="Total Assets"             value={fmt(totalAssets)}      color="#0095db" />
            <TotalRow label="Total Liabilities + Equity" value={fmt(totalLiabilities + totalEquity)} color="#16a34a" />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function BSSection({ title, color, rows, total }: { title: string; color: string; rows: { account: string; amount: number }[]; total: number }) {
  return (
    <View style={sec.container}>
      <Text style={[sec.title, { color }]}>{title}</Text>
      {rows.map((r, i) => (
        <View key={i} style={sec.row}>
          <Text style={sec.label}>{r.account}</Text>
          <Text style={[sec.value, { color }]}>{fmt(r.amount)}</Text>
        </View>
      ))}
      <View style={[sec.row, sec.totalRow]}>
        <Text style={sec.totalLabel}>Total {title}</Text>
        <Text style={[sec.totalValue, { color }]}>{fmt(total)}</Text>
      </View>
    </View>
  );
}

function TotalRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={tot.row}>
      <Text style={tot.label}>{label}</Text>
      <Text style={[tot.value, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f1f5f9' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:      { padding: 16, paddingBottom: 32 },
  error:        { textAlign: 'center', color: '#ef4444', marginTop: 40, fontSize: 14 },
  fyRow:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
  fyBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  fyActive:     { backgroundColor: '#0095db', borderColor: '#0095db' },
  fyText:       { fontSize: 12, fontWeight: '600', color: '#475569' },
  fyActiveText: { color: '#fff' },
  checkBanner:  { padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  checkText:    { fontSize: 13, fontWeight: '700' },
  totalsCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 4 },
});
const sec = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  title:     { fontSize: 13, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label:     { fontSize: 13, color: '#475569', flex: 1 },
  value:     { fontSize: 13, fontWeight: '600' },
  totalRow:  { marginTop: 4, borderTopWidth: 2, borderTopColor: '#e2e8f0', borderBottomWidth: 0, paddingTop: 10 },
  totalLabel:{ fontSize: 13, fontWeight: '800', color: '#0f172a', flex: 1 },
  totalValue:{ fontSize: 14, fontWeight: '800' },
});
const tot = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569' },
  value: { fontSize: 14, fontWeight: '800' },
});
