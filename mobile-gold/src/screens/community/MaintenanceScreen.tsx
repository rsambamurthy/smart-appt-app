import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../api/client';
import { useAppSelector } from '../../store';
import { isEnabled } from '../../navigation/menuConfig';
import type { MaintenanceTicket } from '../../api/types';

const PRIMARY = '#7C3AED';
const STATUS_COLOR: Record<string, string> = { SUBMITTED: '#f59e0b', ACKNOWLEDGED: '#8b5cf6', IN_PROGRESS: '#0891b2', RESOLVED: '#10b981', CLOSED: '#6b7280' };
const PRIORITY_COLOR: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', EMERGENCY: '#dc2626' };

const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'CIVIL', 'HOUSEKEEPING', 'COMMON_AREA', 'OTHERS'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] as const;

const unitLabel = (t: MaintenanceTicket) => t.unit ? `${t.unit.block ? t.unit.block + '-' : ''}${t.unit.flat_number}` : '—';

export default function MaintenanceScreen() {
  const config = useAppSelector(s => s.auth.mobileConfig);
  const canRaise = isEnabled('maintenance_new', config);

  const [tickets,    setTickets]    = useState<MaintenanceTicket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Raise-request form state
  const [showForm,   setShowForm]   = useState(false);
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [category,   setCategory]   = useState<string>('PLUMBING');
  const [priority,   setPriority]   = useState<string>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: MaintenanceTicket[] }>('/maintenance?limit=50');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      // Managers/committee see all tickets; other roles fall back to their own
      if (e instanceof ApiError && e.status === 403) {
        try {
          const mine = await api.get<{ data: MaintenanceTicket[] }>('/maintenance/my?limit=50');
          setTickets(Array.isArray(mine.data) ? mine.data : []);
        } catch (e2: any) {
          setError(e2?.message ?? 'Failed to load tickets.');
        }
      } else {
        setError(e?.message ?? 'Failed to load tickets.');
      }
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !desc.trim()) {
      Alert.alert('Missing details', 'Please enter a title and description.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/maintenance', { title: title.trim(), description: desc.trim(), category, priority });
      setShowForm(false);
      setTitle(''); setDesc(''); setCategory('PLUMBING'); setPriority('MEDIUM');
      Alert.alert('Submitted', 'Your service request has been raised.');
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to raise the request.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <View style={[s.center, { backgroundColor: '#f8fafc' }]}><ActivityIndicator color={PRIMARY} size="large" /></View>;

  if (error) return (
    <View style={[s.center, { backgroundColor: '#f8fafc', padding: 32 }]}>
      <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <TouchableOpacity onPress={() => load()} style={s.retryBtn}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F3FF' }}>
      <FlatList
        data={tickets}
        keyExtractor={t => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PRIMARY]} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No service requests.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.title} numberOfLines={1}>{item.title}</Text>
              <View style={[s.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? '#6b7280') + '20' }]}>
                <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] ?? '#6b7280' }]}>{item.status.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
            <View style={s.cardBottom}>
              <Ionicons name="flag-outline" size={12} color={PRIORITY_COLOR[item.priority] ?? '#6b7280'} />
              <Text style={[s.priority, { color: PRIORITY_COLOR[item.priority] ?? '#6b7280' }]}>{item.priority}</Text>
              <Text style={s.unit}>Unit {unitLabel(item)}</Text>
              <Text style={s.date}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
            </View>
          </View>
        )}
      />

      {/* Raise request FAB */}
      {canRaise && (
        <TouchableOpacity style={s.fab} onPress={() => setShowForm(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Raise request form */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Raise a Service Request</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Title</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Water leakage in bathroom"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                maxLength={255}
              />

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Describe the issue…"
                placeholderTextColor="#9ca3af"
                value={desc}
                onChangeText={setDesc}
                multiline
              />

              <Text style={s.label}>Category</Text>
              <View style={s.chipRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
                    <Text style={[s.chipText, category === c && s.chipActiveText]}>{c.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Priority</Text>
              <View style={s.chipRow}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity key={p} style={[s.chip, priority === p && { backgroundColor: PRIORITY_COLOR[p] }]} onPress={() => setPriority(p)}>
                    <Text style={[s.chipText, priority === p && s.chipActiveText]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit Request</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryBtn:  { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  list:      { padding: 16, paddingBottom: 90 },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:     { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a', marginRight: 8 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  desc:      { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priority:  { fontSize: 11, fontWeight: '600', marginRight: 8 },
  unit:      { fontSize: 11, color: '#64748b', fontWeight: '600' },
  date:      { fontSize: 11, color: '#94a3b8', marginLeft: 'auto' },

  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },

  modalWrap: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e1b4b' },
  label:     { fontSize: 11, fontWeight: '700', color: '#5B21B6', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input:     { borderWidth: 1.5, borderColor: '#C4B5FD', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e1b4b', backgroundColor: '#FDFCFF' },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: PRIMARY },
  chipText:  { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipActiveText: { color: '#fff' },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
