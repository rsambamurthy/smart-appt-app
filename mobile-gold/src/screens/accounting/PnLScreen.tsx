import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../../api/client';
import type { PnLReport } from '../../api/types';

const PRIMARY = '#7C3AED';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

const currentFY = () => {
  const now = new Date(); const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
};

export default function PnLScreen() {
  const [fy,      setFy]      = useState(currentFY());
  const [report,  setReport]  = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fyOptions = Array.from({ length: 4 }, (_, i) => {
    const base = parseInt(currentFY().split('-')[0]) - i;
    return `${base}-${base + 1}`;
  });

  const load = async (f: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<{ data: PnLReport }>(`/accounting/journal/pnl?fy=${f}`);
      setReport(res.data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load P&L report.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(fy); }, [fy]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.fyRow}>
        {fyOptions.map(f => (
          <TouchableOpacity key={f} style={[s.fyChip, fy === f && s.fyActive]} onPress={() => setFy(f)}>
            <Text style={[s.fyText, fy === f && s.fyActiveText]}>FY {f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} size="large" /> : error ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => load(fy)} style={{ backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !report ? (
        <Text style={s.empty}>No P&L data for FY {fy}</Text>
      ) : (
        <>
          <Section title="Income" color="#10b981" items={report.income} total={report.total_income} />
          <Section title="Expenses" color="#ef4444" items={report.expenses} total={report.total_expenses} />
          <View style={[s.netCard, { backgroundColor: report.net_surplus >= 0 ? '#10b981' : '#ef4444' }]}>
            <Text style={s.netLabel}>Net {report.net_surplus >= 0 ? 'Surplus' : 'Deficit'}</Text>
            <Text style={s.netAmount}>{fmt(Math.abs(report.net_surplus))}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, color, items, total }: { title: string; color: string; items: any[]; total: number }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color }]}>{title}</Text>
      {items.map(item => (
        <View key={item.account_code} style={s.row}>
          <Text style={s.rowName}>{item.account_name}</Text>
          <Text style={s.rowAmt}>{fmt(item.amount)}</Text>
        </View>
      ))}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total {title}</Text>
        <Text style={[s.totalAmt, { color }]}>{fmt(total)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content:   { padding: 16, paddingBottom: 40 },
  fyRow:     { marginBottom: 16 },
  fyChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0', marginRight: 8 },
  fyActive:  { backgroundColor: PRIMARY },
  fyText:    { fontSize: 13, fontWeight: '600', color: '#64748b' },
  fyActiveText: { color: '#fff' },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  section:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  rowName:   { color: '#475569', flex: 1 },
  rowAmt:    { color: '#0f172a', fontWeight: '600' },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },
  totalLabel: { fontWeight: '700', color: '#0f172a' },
  totalAmt:  { fontWeight: '800', fontSize: 16 },
  netCard:   { borderRadius: 14, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  netAmount: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
