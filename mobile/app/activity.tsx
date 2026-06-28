import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchCategories,
  fetchHomeCompetencies,
  getActivitySummary,
  type ActivityCategory,
} from '@/src/services/triviaApi';
import { accentFor, colors, radius, scoreColor, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Category = Database['public']['Tables']['categories']['Row'];
type Competency = Database['public']['Tables']['category_competencies']['Row'];

type Row = {
  id: string;
  name: string;
  reps: number;
  accuracy: number;
  score: number;
  delta: number;
};

export default function ActivityScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [overall, setOverall] = useState<{ score: number; delta: number; attempts: number } | null>(null);
  const [monthReps, setMonthReps] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [summary, comps, cats] = await Promise.all([
        getActivitySummary(30),
        fetchHomeCompetencies(),
        fetchCategories(),
      ]);
      const competencies = (comps ?? []) as Competency[];
      const categories = (cats ?? []) as Category[];
      const nameById = new Map(categories.map((c) => [c.id, c.name]));
      const compByKey = new Map(
        competencies.filter((c) => c.dimension_type === 'category').map((c) => [c.dimension_key, c]),
      );
      const actByCat = new Map((summary.by_category as ActivityCategory[]).map((a) => [a.category_id, a]));

      const overallRow = competencies.find((c) => c.dimension_type === 'overall');
      setOverall(
        overallRow
          ? { score: overallRow.score, delta: overallRow.seven_day_delta ?? 0, attempts: overallRow.attempts ?? 0 }
          : null,
      );
      setMonthReps((summary.by_category as ActivityCategory[]).reduce((s, a) => s + a.reps, 0));

      // One row per category that has either reps this month or a competency score, reps desc.
      const ids = new Set<string>([...actByCat.keys(), ...compByKey.keys()]);
      const built: Row[] = [...ids]
        .map((id) => {
          const act = actByCat.get(id);
          const comp = compByKey.get(id);
          return {
            id,
            name: nameById.get(id) ?? id,
            reps: act?.reps ?? 0,
            accuracy: act?.accuracy ?? 0,
            score: comp?.score ?? 0,
            delta: comp?.seven_day_delta ?? 0,
          };
        })
        .filter((r) => r.reps > 0 || r.score > 0)
        .sort((a, b) => b.reps - a.reps);
      setRows(built);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const placed = (overall?.attempts ?? 0) >= 15;
  const deltaText = useMemo(() => {
    const d = overall?.delta ?? 0;
    return d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : 'steady';
  }, [overall]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <FontAwesome name="angle-left" size={26} color={colors.muted} />
        </Pressable>
        <Text style={styles.title}>Activity</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        {/* Overall competency summary (the time-series line is a follow-up — needs daily snapshots) */}
        <View style={styles.card}>
          <Text style={styles.overline}>Overall competency</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              {placed ? (
                <>
                  <Text style={[styles.bigNum, { color: scoreColor(overall?.score ?? 0) }]}>{overall?.score ?? 0}</Text>
                  <Text style={styles.bigCaption}>
                    this week <Text style={delta(overall?.delta ?? 0)}>{deltaText}</Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.tierNum, { color: colors.gold }]}>Getting started</Text>
                  <Text style={styles.bigCaption}>
                    {Math.max(0, 15 - (overall?.attempts ?? 0))} more reps to map your level
                  </Text>
                </>
              )}
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.overline}>Last 30 days</Text>
              <Text style={styles.bigNum}>{monthReps}</Text>
              <Text style={styles.bigCaption}>questions</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.overline, styles.sectionTop]}>By category · this month</Text>
        <View style={styles.card}>
          {loading && rows.length === 0 ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: spacing.lg }} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>No reps yet — start a run to fill this in.</Text>
          ) : (
            <>
              <View style={styles.headRow}>
                <Text style={[styles.hName]}>Category</Text>
                <Text style={styles.hCol}>Qs</Text>
                <Text style={styles.hColAcc}>Acc</Text>
                <Text style={styles.hColWide}>7d Δ</Text>
              </View>
              {rows.map((r, i) => (
                <View key={r.id} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
                  <View style={[styles.dot, { backgroundColor: accentFor(r.id) }]} />
                  <Text style={styles.cName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.cCol}>{r.reps}</Text>
                  <Text style={[styles.cColAcc, styles.muted]} numberOfLines={1}>
                    {r.reps > 0 ? `${r.accuracy}%` : '—'}
                  </Text>
                  <Text style={[styles.cColWide, delta(r.delta)]}>
                    {r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${Math.abs(r.delta)}` : '—'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function delta(d: number) {
  return { color: d > 0 ? colors.green : d < 0 ? colors.red : colors.dim, fontWeight: '700' as const };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  back: { padding: 4 },
  title: { ...type.title, color: colors.ink },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  overline: { ...type.overline, color: colors.muted },
  sectionTop: { marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: spacing.sm },
  summaryLeft: { flex: 1, paddingRight: spacing.sm },
  summaryRight: { alignItems: 'flex-end' },
  bigNum: { ...type.display, color: colors.ink },
  tierNum: { ...type.title, color: colors.gold },
  bigCaption: { ...type.caption, color: colors.muted, marginTop: 2 },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  hName: { ...type.caption, color: colors.dim, flex: 1 },
  hCol: { ...type.caption, color: colors.dim, width: 34, textAlign: 'right' },
  hColAcc: { ...type.caption, color: colors.dim, width: 50, textAlign: 'right' },
  hColWide: { ...type.caption, color: colors.dim, width: 46, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowLast: { borderBottomWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  cName: { ...type.body, fontWeight: '600', color: colors.ink, flex: 1 },
  cCol: { ...type.bodyStrong, color: colors.ink, width: 34, textAlign: 'right' },
  cColAcc: { ...type.bodyStrong, color: colors.ink, width: 50, textAlign: 'right' },
  cColWide: { width: 46, textAlign: 'right', fontSize: 13 },
  muted: { color: colors.muted, fontWeight: '600' },
  empty: { ...type.body, color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg },
});
