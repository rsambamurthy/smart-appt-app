/**
 * Second level of the mobile menu: shows the enabled items of one category
 * (Community / Accounting / Dues / Visitors) as cards.
 */
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../store';
import { CATEGORIES, enabledItems } from '../navigation/menuConfig';

const PRIMARY = '#7C3AED';

export default function CategoryScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const config     = useAppSelector(s => s.auth.mobileConfig);

  const categoryId = route.params?.categoryId as string | undefined;
  const category   = CATEGORIES.find(c => c.id === categoryId);

  if (!category) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>Section not found.</Text>
      </View>
    );
  }

  const items = enabledItems(category, config);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Category banner */}
      <View style={[s.banner, { backgroundColor: category.color }]}>
        <Ionicons name={category.icon} size={26} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={s.bannerTitle}>{category.label}</Text>
          <Text style={s.bannerSub}>
            {items.length} {items.length === 1 ? 'section' : 'sections'} available
          </Text>
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={s.empty}>No sections are enabled in {category.label}.</Text>
      ) : (
        <View style={s.grid}>
          {items.map(item => (
            <TouchableOpacity
              key={item.screen}
              style={[s.tile, { borderTopColor: item.color }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.8}
            >
              <View style={[s.tileIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={s.tileLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  content:   { padding: 16, paddingBottom: 32 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' },
  empty:     { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 24 },

  banner: {
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  bannerTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
  bannerSub:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  tile: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
});
