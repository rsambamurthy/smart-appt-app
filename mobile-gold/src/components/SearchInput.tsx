import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#7C3AED';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Candidate strings used to build type-ahead suggestions. */
  suggestions: string[];
  placeholder?: string;
  maxSuggestions?: number;
}

/**
 * Free-text search box with a type-ahead suggestion list.
 * Typing filters the list as usual; tapping a suggestion fills the exact term.
 */
export default function SearchInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Search…',
  maxSuggestions = 6,
}: Props) {
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const uniq = Array.from(new Set(suggestions.filter(Boolean)));
    return uniq
      .map(s => {
        const l = s.toLowerCase();
        if (l === q) return null;
        if (l.startsWith(q)) return { s, score: 0 };
        if (l.includes(q))   return { s, score: 1 };
        return null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.score - b.score || a.s.localeCompare(b.s))
      .slice(0, maxSuggestions)
      .map((x: any) => x.s as string);
  }, [value, suggestions, maxSuggestions]);

  const show = focused && matches.length > 0;

  return (
    <View style={s.wrap}>
      <View style={s.inputRow}>
        <Ionicons name="search" size={16} color="#9ca3af" style={{ marginLeft: 12 }} />
        <TextInput
          style={s.input}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          // Delay so a suggestion tap registers before the list closes
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChange('')} style={{ padding: 10 }}>
            <Ionicons name="close-circle" size={16} color="#c4b5fd" />
          </TouchableOpacity>
        )}
      </View>

      {show && (
        <View style={s.dropdown}>
          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 190 }}>
            {matches.map(m => (
              <TouchableOpacity
                key={m}
                style={s.item}
                onPress={() => { onChange(m); setFocused(false); }}
                activeOpacity={0.7}
              >
                <Ionicons name="return-down-forward" size={13} color={PRIMARY} />
                <Text style={s.itemText} numberOfLines={1}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { position: 'relative', zIndex: 20, marginBottom: 12 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  input:    { flex: 1, padding: 13, paddingLeft: 8, fontSize: 15, color: '#1e1b4b' },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EDE9FE',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, overflow: 'hidden',
  },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  itemText: { flex: 1, fontSize: 14, color: '#1e293b' },
});
