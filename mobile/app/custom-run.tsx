import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tapLight, tapMedium } from '@/src/lib/haptics';
import { fetchCategories } from '@/src/services/triviaApi';
import { accentFor, colors, radius, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Category = Database['public']['Tables']['categories']['Row'];

// Difficulty tiers map to clue values (get_recommended_questions filters on value).
const DIFFICULTIES: { label: string; value: number; pips: string }[] = [
  { label: 'Easy', value: 200, pips: '•' },
  { label: 'Medium', value: 400, pips: '••' },
  { label: 'Hard', value: 600, pips: '•••' },
  { label: 'Expert', value: 800, pips: '••••' },
  { label: 'Master', value: 1000, pips: '•••••' },
];
const LENGTHS = [6, 12, 20];

export default function CustomRunScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedValues, setSelectedValues] = useState<Set<number>>(
    new Set(DIFFICULTIES.map((d) => d.value)),
  );
  const [length, setLength] = useState(12);

  const loadCategories = useCallback(async () => {
    const rows = await fetchCategories();
    const list = (rows ?? []) as Category[];
    setCategories(list);
    // Default: everything selected — narrowing is the point, so start from "all".
    setSelectedCats(new Set(list.map((c) => c.id)));
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const allSelected = categories.length > 0 && selectedCats.size === categories.length;

  function toggleCategory(id: string) {
    tapLight();
    setSelectedCats((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    tapLight();
    setSelectedCats(allSelected ? new Set() : new Set(categories.map((c) => c.id)));
  }

  function toggleValue(value: number) {
    tapLight();
    setSelectedValues((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const summary = useMemo(() => {
    const nc = selectedCats.size;
    const catLabel =
      nc === 0 ? 'No categories' : allSelected ? 'All categories' : `${nc} categor${nc === 1 ? 'y' : 'ies'}`;
    const onTiers = DIFFICULTIES.filter((d) => selectedValues.has(d.value));
    const diffLabel =
      onTiers.length === 0
        ? 'no difficulty'
        : onTiers.length === DIFFICULTIES.length
          ? 'all difficulties'
          : onTiers.length <= 2
            ? onTiers.map((d) => d.label).join(' & ')
            : `${onTiers[0].label}–${onTiers[onTiers.length - 1].label}`;
    return { catLabel, diffLabel };
  }, [selectedCats, selectedValues, allSelected]);

  const canStart = selectedCats.size > 0 && selectedValues.size > 0;

  function start() {
    if (!canStart) return;
    tapMedium();
    router.replace({
      pathname: '/train',
      params: {
        start: 'custom',
        // If everything is on, omit the filter so the RPC isn't needlessly constrained.
        categories: allSelected ? '' : [...selectedCats].join(','),
        values: selectedValues.size === DIFFICULTIES.length ? '' : [...selectedValues].join(','),
        limit: String(length),
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <FontAwesome name="angle-left" size={26} color={colors.muted} />
        </Pressable>
        <Text style={styles.title}>Custom run</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionRow}>
          <Text style={styles.overline}>Categories</Text>
          <Pressable onPress={toggleAll} hitSlop={8}>
            <Text style={styles.link}>{allSelected ? 'Clear all' : 'Select all'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {categories.length === 0 ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: spacing.lg }} />
          ) : (
            categories.map((category, index) => {
              const on = selectedCats.has(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggleCategory(category.id)}
                  style={[styles.optRow, index === categories.length - 1 && styles.optRowLast]}
                >
                  <View style={[styles.dot, { backgroundColor: accentFor(category.id) }]} />
                  <Text style={styles.optName} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <FontAwesome name="check" size={13} color={colors.background} /> : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.overline, styles.sectionTop]}>Difficulty</Text>
        <View style={styles.diffs}>
          {DIFFICULTIES.map((d) => {
            const on = selectedValues.has(d.value);
            return (
              <Pressable key={d.value} onPress={() => toggleValue(d.value)} style={[styles.dchip, on && styles.dchipOn]}>
                <Text style={[styles.dchipPips, on && styles.dchipPipsOn]}>{d.pips}</Text>
                <Text style={[styles.dchipLabel, on && styles.dchipLabelOn]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.overline, styles.sectionTop]}>Length</Text>
        <View style={styles.segmented}>
          {LENGTHS.map((n) => {
            const on = length === n;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  tapLight();
                  setLength(n);
                }}
                style={[styles.segBtn, on && styles.segBtnOn]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.summary}>
          {summary.catLabel} · {summary.diffLabel}
        </Text>
        <Pressable
          onPress={start}
          disabled={!canStart}
          style={({ pressed }) => [styles.startBtn, !canStart && styles.startDisabled, pressed && styles.pressed]}
        >
          <Text style={styles.startText}>Start run · {length} questions</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  back: { padding: 4 },
  title: { ...type.title, color: colors.ink },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTop: { marginTop: spacing.lg, marginBottom: spacing.sm },
  overline: { ...type.overline, color: colors.muted },
  link: { ...type.label, color: colors.gold },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  optRowLast: { borderBottomWidth: 0 },
  dot: { width: 11, height: 11, borderRadius: 3 },
  optName: { ...type.body, fontWeight: '600', color: colors.ink, flex: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  diffs: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  dchip: {
    flexGrow: 1,
    flexBasis: 60,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dchipOn: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  dchipPips: { fontSize: 11, letterSpacing: 1, color: colors.dim },
  dchipPipsOn: { color: colors.gold },
  dchipLabel: { ...type.label, color: colors.muted, marginTop: 3 },
  dchipLabelOn: { color: colors.gold },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 4,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  segBtnOn: { backgroundColor: colors.gold },
  segText: { ...type.bodyStrong, color: colors.muted },
  segTextOn: { color: colors.background },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  summary: { ...type.caption, color: colors.muted, textAlign: 'center', marginBottom: spacing.sm },
  startBtn: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startDisabled: { opacity: 0.4 },
  startText: { ...type.heading, color: colors.background },
  pressed: { opacity: 0.85 },
});
