import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import type { BalanceSheetReport, BalanceSheetItem } from '../../api/types';

const PRIMARY = '#7C3AED';
const fmt = (n: unknown) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const fyLabel = (startYear: number) => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
const currentFYStart = () => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};
/** Balance sheet "as of" = FY end date (31 March of the following year). */
const fyAsOf = (fy: string) => `${parseInt(fy.split('-')[0], 10) + 1}-03-31`;

export default function BalanceSheetScreen() {
  const [fy,      setFy]      = useState(fyLabel(currentFYStart()));
  const [report,  setReport]  = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fyOptions = Array.from({ length: 4 }, (_, i) => fyLabel(currentFYStart() - i));

  const load = (f: string) => {
    setLoading(true); setError(null);
    api.get<{ data: BalanceSheetReport }>(`/accounting/journal/balance-sheet?asOf=${fyAsOf(f)}`)
      .then(r => setReport(r.data ?? null))
      .catch((e: any) => { setError(e?.message ?? 'Failed to load balance sheet.'); setReport(null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(fy); }, [fy]);

  const balanced = report
    ? Math.abs(Number(report.totalAssets ?? 0) - Number(report.totalLiabilitiesAndEquity ?? 0)) < 0.01
    : false;

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
          <BSSection title="Assets"      color="#10b981" items={report.assets      ?? []} total={report.totalAssets} />
          <BSSection title="Liabilities" color="#ef4444" items={report.liabilities ?? []} total={report.totalLiabilities} />
          <BSSection title="Equity"      color="#7C3AED" items={report.equity      ?? []} total={report.totalEquity} extraRow={{ label: 'Net Surplus (current year)', amount: Number(report.netSurplus ?? 0) }} />
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Total Assets</Text>
              <Text style={s.summaryValue}>{fmt(report.totalAssets)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Total Liabilities + Equity</Text>
              <Text style={s.summaryValue}>{fmt(report.totalLiabilitiesAndEquity)}</Text>
            </View>
          </View>
          <View style={[s.banner, { backgroundColor: balanced ? '#10b981' : '#ef4444' }]}>
            <Ionicons name={balanced ? 'checkmark-circle' : 'alert-circle'} size={22} color="#fff" />
            <Text style={s.bannerText}>{balanced ? 'Balance Sheet is Balanced' : 'Balance Sheet is NOT Balanced'}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function BSSection({ title, color, items, total, extraRow }: {
  title: string; color: string; items: BalanceSheetItem[]; total: number;
  extraRow?: { label: string; amount: number };
}) {
  return (
    <View style={s.section}>
      <Text style={[s.sTitle, { color }]}>{title}</Text>
      {items.length === 0 && !extraRow && <Text style={s.noRows}>No {title.toLowerCase()} recorded.</Text>}
      {items.map(item => (
        <View key={item.id} style={s.row}>
          <Text style={s.rName}>{item.code}  {item.name}</Text>
          <Text style={s.rAmt}>{fmt(item.amount)}</Text>
        </View>
      ))}
      {extraRow && (
        <View style={s.row}>
          <Text style={[s.rName, { fontStyle: 'italic' }]}>{extraRow.label}</Text>
          <Text style={s.rAmt}>{fmt(extraRow.amount)}</Text>
        </View>
      )}
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
  noRows:    { color: '#9ca3af', fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  section:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 },
  sTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  rName:     { color: '#475569', flex: 1, fontSize: 13 },
  rAmt:      { fontWeight: '600', color: '#0f172a', fontSize: 13 },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },
  tLabel:    { fontWeight: '700', color: '#0f172a' },
  tAmt:      { fontWeight: '800', fontSize: 16 },
  summaryCard: { backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontWeight: '600', color: '#5B21B6', fontSize: 13 },
  summaryValue: { fontWeight: '700', color: '#1e1b4b', fontSize: 13 },
  banner:    { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
