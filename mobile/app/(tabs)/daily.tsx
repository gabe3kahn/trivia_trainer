import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CalendarHeatmap, Header, MetricCard, Pill, ProgressBar, Screen, Section } from '@/src/components/ui';
import type { DailyActivity } from '@/src/data/mockData';
import { fetchDailyActivity } from '@/src/services/triviaApi';
import { colors, radius, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type DailyRow = Database['public']['Tables']['daily_activity']['Row'];

export default function DailyScreen() {
  const [activityRows, setActivityRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return {
      startDate: toDateKey(start),
      endDate: toDateKey(end),
    };
  }, []);

  const loadDaily = useCallback(async () => {
    try {
      setError(null);
      const rows = await fetchDailyActivity(startDate, endDate);
      setActivityRows(rows ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useFocusEffect(useCallback(() => {
    void loadDaily();
  }, [loadDaily]));

  const dailyActivity = useMemo(() => buildCalendar(startDate, activityRows), [activityRows, startDate]);
  const today = activityRows.find((row) => row.activity_date === endDate);
  const weekReps = activityRows.slice(-7).reduce((sum, row) => sum + row.reps, 0);
  const reviewDue = activityRows.reduce((sum, row) => sum + row.review_reps, 0);
  const streak = calculateStreak(activityRows);
  const dailyMetricDefinitions = [
    { label: 'Today', value: String(today?.reps ?? 0), detail: 'reps' },
    { label: 'Review', value: String(reviewDue), detail: 'logged' },
    { label: 'Week', value: String(weekReps), detail: 'reps' },
  ];
  const todayReps = today?.reps ?? 0;
  const todayReview = today?.review_reps ?? 0;

  return (
    <Screen>
      <Header kicker="Daily" title="Activity" right={<Pill tone="teal">{streak} day streak</Pill>} />

      <View style={styles.metricRow}>
        {dailyMetricDefinitions.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
        ))}
      </View>

      <Section title="Last 30 days">
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <CalendarHeatmap values={dailyActivity} />
        <View style={styles.legend}>
          <LegendItem color={colors.tealSoft} label="practice" />
          <LegendItem color={colors.gold} label="goal" />
          <LegendItem color={colors.teal} label="review" thin />
          <LegendItem color={colors.purple} label="challenge" dot />
        </View>
      </Section>

      <Section title="Today">
        <ActivityRow title="Reps" detail={`${todayReps} / 30`} progress={(todayReps / 30) * 100} label={todayReps >= 30 ? 'Goal met' : 'Open'} />
        <ActivityRow title="Review" detail={`${todayReview} logged`} progress={Math.min(100, todayReview * 10)} label="Queue" tone="gold" />
      </Section>
    </Screen>
  );
}

function buildCalendar(startDate: string, rows: DailyRow[]): DailyActivity[] {
  const byDate = new Map(rows.map((row) => [row.activity_date, row]));
  const start = new Date(`${startDate}T00:00:00`);

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    const row = byDate.get(key);
    return {
      day: date.getDate(),
      reps: row?.reps ?? 0,
      reviewCleared: row?.review_cleared ?? false,
      challengePlayed: row?.challenge_played ?? false,
    };
  });
}

function calculateStreak(rows: DailyRow[]) {
  const datesWithActivity = new Set(rows.filter((row) => row.reps > 0).map((row) => row.activity_date));
  let streak = 0;
  const cursor = new Date();

  while (datesWithActivity.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function LegendItem({ color, label, thin, dot }: { color: string; label: string; thin?: boolean; dot?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }, thin && styles.legendThin, dot && styles.legendDot]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function ActivityRow({ title, detail, progress, label, tone = 'teal' }: { title: string; detail: string; progress: number; label: string; tone?: 'teal' | 'gold' }) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityHeader}>
        <View>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDetail}>{detail}</Text>
        </View>
        <Pill tone={tone}>{label}</Pill>
      </View>
      <ProgressBar value={progress} color={tone === 'gold' ? colors.gold : colors.teal} />
    </View>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  activityRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  legendThin: {
    height: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 0,
  },
  legendText: {
    ...type.caption,
    color: colors.muted,
  },
  errorText: {
    ...type.caption,
    color: colors.red,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  rowDetail: {
    ...type.caption,
    color: colors.muted,
    marginTop: 3,
  },
});
