import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import type { BalanceSheetReport } from '../../api/types';

const PRIMARY = '#7C3AED';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
const currentFY = () => { const now = new Date(); const y = now.getFullYear(); return now.getMonth() >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`; };

export default function BalanceSheetScreen() {
  const [fy,      setFy]      = useState(currentFY());
  const [report,  setReport]  = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fyOptions = Array.from({ length: 4 }, (_, i) => { const base = parseInt(currentFY().split('-')[0]) - i; return `${base}-${base + 1}`; });

  const load = (f: string) => {
    setLoading(true); setError(null);
    api.get<{ data: BalanceSheetReport }>(`/accounting/journal/balance-sheet?fy=${f}`)
      .then(r => setReport(r.data))
      .catch((e: any) => setError(e?.message ?? 'Failed to load balance sheet.'))
      .finally(() => setLoading(false));
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
        <Text style={s.empty}>No balance sheet data for FY {fy}</Text>
      ) : (
        <>
          <BSSection title="Assets"       color="#10b981" items={report.assets}      total={report.total_assets} />
          <BSSection title="Liabilities"  color="#ef4444" items={report.liabilities} total={report.total_liabilities_equity} />
          <BSSection title="Equity"       color="#7C3AED" items={report.equity}      total={report.total_liabilities_equity} />
          <View style={[s.banner, { backgroundColor: report.balanced ? '#10b981' : '#ef4444' }]}>
            <Ionicons name={report.balanced ? 'checkmark-circle' : 'alert-circle'} size={22} color="#fff" />
            <Text style={s.bannerText}>{report.balanced ? 'Balance Sheet is Balanced' : 'Balance Sheet is NOT Balanced'}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function BSSection({ title, color, items, total }: { title: string; color: string; items: any[]; total: number }) {
  return (
    <View style={s.section}>
      <Text style={[s.sTitle, { color }]}>{title}</Text>
      {items.map(item => (
        <View key={item.account_code} style={s.row}>
          <Text style={s.rName}>{item.account_name}</Text>
          <Text style={s.rAmt}>{fmt(item.amount)}</Text>
        </View>
      ))}
      <View style={s.totalRow}>
        <Text style={s.tLabel}>Total {title}</Text>
        <Text style={[s.tAmt, { color }]}>{fmt(total)}</Text>
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
  sTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  rName:     { color: '#475569', flex: 1 },
  rAmt:      { fontWeight: '600', color: '#0f172a' },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },
  tLabel:    { fontWeight: '700', color: '#0f172a' },
  tAmt:      { fontWeight: '800', fontSize: 16 },
  banner:    { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
