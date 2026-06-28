import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActivityDay } from '@/src/services/triviaApi';
import { accentFor, colors, radius, spacing, type } from '@/src/theme';

/* PT calendar-day key (matches get_activity_summary's bucketing) regardless of device tz. */
const ptKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
const ptWeekday = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'narrow' }).format(d);

const DAY_MS = 86_400_000;

/** Build a contiguous window of the last `n` PT days, each filled from `daily` (zero if absent). */
function buildWindow(daily: ActivityDay[], n: number): ActivityDay[] {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const key = ptKey(new Date(now - (n - 1 - i) * DAY_MS));
    return byDate.get(key) ?? { date: key, total: 0, correct: 0, missed: 0, by_category: {} };
  });
}

/* ------------------------------------------------------------------ *
 * StreakStrip — flame count + last-7-day dots, drives the daily habit.
 * ------------------------------------------------------------------ */
export function StreakStrip({ daily, streak }: { daily: ActivityDay[]; streak: number }) {
  const week = useMemo(() => buildWindow(daily, 7), [daily]);
  const playedToday = (week[week.length - 1]?.total ?? 0) > 0;

  return (
    <View style={styles.streakCard}>
      <View style={styles.streakLeft}>
        <Text style={styles.flame}>{streak > 0 ? `🔥 ${streak}-day streak` : '🔥 Start your streak'}</Text>
        <Text style={styles.goal}>
          1 session a day{playedToday ? " · you're in today ✓" : ' · play to keep it alive'}
        </Text>
      </View>
      <View style={styles.dots}>
        {week.map((d, i) => {
          const on = d.total > 0;
          const today = i === week.length - 1;
          return (
            <View key={d.date} style={[styles.dot, on && styles.dotOn, today && styles.dotToday]}>
              <Text style={[styles.dotText, on && styles.dotTextOn]}>{ptWeekday(new Date(d.date + 'T12:00:00'))}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ActivityChart — 30-day stacked bars, toggle Correct·Missed / Category.
 * ------------------------------------------------------------------ */
const BAR_AREA = 132;

export function ActivityChart({
  daily,
  days = 30,
  onPressDetail,
}: {
  daily: ActivityDay[];
  days?: number;
  onPressDetail?: () => void;
}) {
  const [mode, setMode] = useState<'cm' | 'cat'>('cm');
  const window = useMemo(() => buildWindow(daily, days), [daily, days]);
  const maxTotal = Math.max(1, ...window.map((d) => d.total));

  const totals = useMemo(() => {
    const total = window.reduce((s, d) => s + d.total, 0);
    const correct = window.reduce((s, d) => s + d.correct, 0);
    const active = window.filter((d) => d.total > 0).length;
    return { total, correct, active, pct: total ? Math.round((correct / total) * 100) : 0 };
  }, [window]);

  const isEmpty = totals.total === 0;

  return (
    <View style={styles.card}>
      <View style={styles.chartHead}>
        <Text style={styles.overline}>Last {days} days</Text>
        {isEmpty ? null : (
          <View style={styles.toggle}>
            {(['cm', 'cat'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.tBtn, mode === m && styles.tBtnOn]}>
                <Text style={[styles.tText, mode === m && styles.tTextOn]}>{m === 'cm' ? 'Correct · Missed' : 'By category'}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>
            Your {days}-day chart fills in as you answer — correct vs. missed, color-coded by category.
          </Text>
        </View>
      ) : (
      <Pressable
        onPress={onPressDetail}
        disabled={!onPressDetail}
        style={({ pressed }) => (pressed && onPressDetail ? styles.bodyPressed : undefined)}
      >
        <View style={styles.chart}>
          {window.map((d, i) => {
            const barH = (d.total / maxTotal) * BAR_AREA;
            const today = i === window.length - 1;
            return (
              <View key={d.date} style={[styles.barCol, today && styles.barToday]}>
                {d.total === 0 ? (
                  <View style={styles.barEmpty} />
                ) : mode === 'cm' ? (
                  <>
                    <View style={{ height: (d.missed / d.total) * barH, backgroundColor: colors.red, opacity: 0.85 }} />
                    <View style={{ height: (d.correct / d.total) * barH, backgroundColor: colors.green }} />
                  </>
                ) : (
                  Object.entries(d.by_category).map(([cat, n]) => (
                    <View key={cat} style={{ height: (n / d.total) * barH, backgroundColor: accentFor(cat) }} />
                  ))
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.xaxis}>
          {(days === 30 ? ['4 wks ago', '3 wks', '2 wks', '1 wk', 'today'] : [`${days}d ago`, 'today']).map((label) => (
            <Text key={label} style={styles.xLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.summary}>
          <Stat label="This month" value={String(totals.total)} />
          <Stat label="Correct" value={`${totals.pct}%`} tone={colors.green} />
          <Stat label="Active days" value={`${totals.active}/${days}`} />
        </View>

        {onPressDetail ? (
          <View style={styles.detailFooter}>
            <Text style={styles.detailFooterText}>View full activity ›</Text>
          </View>
        ) : null}
      </Pressable>
      )}
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  streakLeft: { flex: 1, paddingRight: spacing.sm },
  flame: { ...type.bodyStrong, color: colors.gold },
  goal: { ...type.caption, color: colors.muted, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.goldSoft, borderColor: 'rgba(242,184,75,0.5)' },
  dotToday: { borderColor: colors.gold, borderWidth: 1.5 },
  dotText: { fontSize: 9, fontWeight: '700', color: colors.dim },
  dotTextOn: { color: colors.gold },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overline: { ...type.overline, color: colors.muted },
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, padding: 3 },
  tBtn: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.pill },
  tBtnOn: { backgroundColor: colors.gold },
  tText: { fontSize: 10.5, fontWeight: '700', color: colors.muted },
  tTextOn: { color: colors.background },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_AREA, marginTop: spacing.md },
  barCol: { flex: 1, flexDirection: 'column', borderRadius: 2, overflow: 'hidden', minHeight: 2, justifyContent: 'flex-end' },
  barToday: { borderRadius: 3, borderWidth: 1.5, borderColor: colors.gold },
  barEmpty: { height: 2, backgroundColor: colors.lineSoft },
  xaxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { fontSize: 10, color: colors.dim, fontWeight: '600' },

  summary: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  statLabel: { ...type.caption, color: colors.muted },
  statValue: { ...type.heading, color: colors.ink, marginTop: 2 },
  bodyPressed: { opacity: 0.6 },
  detailFooter: { alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  detailFooterText: { ...type.label, color: colors.gold },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: 7 },
  emptyIcon: { fontSize: 26, opacity: 0.85 },
  emptyTitle: { ...type.bodyStrong, color: colors.ink },
  emptyBody: { ...type.caption, color: colors.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing.md },
});
