import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line as SvgLine, Polygon, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import type { ActivityDay, CompetencyPoint } from '@/src/services/triviaApi';
import { colors, radius, scoreColor, spacing, type } from '@/src/theme';

/* PT calendar-day key (matches the RPC bucketing) regardless of device tz. */
const ptKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
const ptWeekday = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'narrow' }).format(d);

const DAY_MS = 86_400_000;
const CHART_H = 140;

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
 * ActivityChart — headline = overall competency over time (a line, 50 = par);
 * toggle to the Correct·Missed daily bars. Tapping opens the full Activity view.
 * ------------------------------------------------------------------ */
export function ActivityChart({
  competency,
  daily,
  days = 30,
  onPressDetail,
}: {
  competency: CompetencyPoint[];
  daily: ActivityDay[];
  days?: number;
  onPressDetail?: () => void;
}) {
  const [mode, setMode] = useState<'competency' | 'cm'>('competency');
  const [width, setWidth] = useState(0);

  // Competency line: plot from the first day with any attempts (a flat-zero lead-in is noise).
  const series = useMemo(() => {
    const firstActive = competency.findIndex((p) => p.attempts > 0);
    return firstActive === -1 ? [] : competency.slice(firstActive);
  }, [competency]);

  const window = useMemo(() => buildWindow(daily, days), [daily, days]);
  const maxTotal = Math.max(1, ...window.map((d) => d.total));
  const cm = useMemo(() => {
    const total = window.reduce((s, d) => s + d.total, 0);
    const correct = window.reduce((s, d) => s + d.correct, 0);
    const active = window.filter((d) => d.total > 0).length;
    return { total, correct, active, pct: total ? Math.round((correct / total) * 100) : 0 };
  }, [window]);

  const hasCompetency = series.length > 0;
  const hasActivity = cm.total > 0;
  const bothEmpty = !hasCompetency && !hasActivity;

  const now = hasCompetency ? series[series.length - 1].score : 0;
  const first = hasCompetency ? series[0].score : 0;
  const peak = series.reduce((m, p) => Math.max(m, p.score), 0);
  const delta = now - first;

  const xLabels = days === 30 ? ['4 wks ago', '3 wks', '2 wks', '1 wk', 'today'] : [`${days}d ago`, 'today'];

  if (bothEmpty) {
    return (
      <View style={styles.card}>
        <View style={styles.chartHead}>
          <Text style={styles.overline}>Last {days} days</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>
            Answer questions and your overall competency starts charting here — 50 is par.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.chartHead}>
        <Text style={styles.overline}>Last {days} days</Text>
        <View style={styles.toggle}>
          {(['competency', 'cm'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.tBtn, mode === m && styles.tBtnOn]}>
              <Text style={[styles.tText, mode === m && styles.tTextOn]}>
                {m === 'competency' ? 'Competency' : 'Correct · Missed'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={onPressDetail}
        disabled={!onPressDetail}
        style={({ pressed }) => (pressed && onPressDetail ? styles.bodyPressed : undefined)}
      >
        {mode === 'competency' ? (
          hasCompetency ? (
            <>
              <View style={styles.lineWrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 ? <CompetencyLine width={width} height={CHART_H} series={series} /> : null}
              </View>
              <View style={styles.xaxis}>
                {xLabels.map((label) => (
                  <Text key={label} style={styles.xLabel}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.summary}>
                <Stat label="Now" value={String(now)} tone={scoreColor(now)} />
                <Stat
                  label="This month"
                  value={delta >= 0 ? `▲ +${delta}` : `▼ ${delta}`}
                  tone={delta >= 0 ? colors.green : colors.red}
                />
                <Stat label="Peak" value={String(peak)} />
              </View>
            </>
          ) : (
            <View style={styles.miniNote}>
              <Text style={styles.miniNoteText}>Answer questions to start your competency line — 50 is par.</Text>
            </View>
          )
        ) : hasActivity ? (
          <>
            <View style={styles.chart}>
              {window.map((d, i) => {
                const barH = (d.total / maxTotal) * CHART_H;
                const today = i === window.length - 1;
                return (
                  <View key={d.date} style={[styles.barCol, today && styles.barToday]}>
                    {d.total === 0 ? (
                      <View style={styles.barEmpty} />
                    ) : (
                      <>
                        <View style={{ height: (d.missed / d.total) * barH, backgroundColor: colors.red, opacity: 0.85 }} />
                        <View style={{ height: (d.correct / d.total) * barH, backgroundColor: colors.green }} />
                      </>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.xaxis}>
              {xLabels.map((label) => (
                <Text key={label} style={styles.xLabel}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
                <Text style={styles.legendText}>Correct</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
                <Text style={styles.legendText}>Missed</Text>
              </View>
            </View>
            <View style={styles.summary}>
              <Stat label="This month" value={String(cm.total)} />
              <Stat label="Correct" value={`${cm.pct}%`} tone={colors.green} />
              <Stat label="Active days" value={`${cm.active}/${days}`} />
            </View>
          </>
        ) : (
          <View style={styles.miniNote}>
            <Text style={styles.miniNoteText}>No answered questions in the last {days} days yet.</Text>
          </View>
        )}

        {onPressDetail ? (
          <View style={styles.detailFooter}>
            <Text style={styles.detailFooterText}>View full activity ›</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function CompetencyLine({ width, height, series }: { width: number; height: number; series: CompetencyPoint[] }) {
  const n = series.length;
  const pad = 3;
  const x = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
  const y = (v: number) => height - (v / 100) * height;
  const stroke = scoreColor(series[n - 1].score);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${height} ${pts} ${x(n - 1).toFixed(1)},${height}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="compFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {/* par line at 50 */}
      <SvgLine x1={0} y1={y(50)} x2={width} y2={y(50)} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />
      <SvgText x={2} y={y(50) - 4} fill={colors.dim} fontSize={9} fontWeight="700">
        par 50
      </SvgText>
      <Polygon points={area} fill="url(#compFill)" />
      <Polyline points={pts} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(n - 1)} cy={y(series[n - 1].score)} r={4} fill={stroke} stroke={colors.background} strokeWidth={2} />
    </Svg>
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

  lineWrap: { height: CHART_H, marginTop: spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: CHART_H, marginTop: spacing.md },
  barCol: { flex: 1, flexDirection: 'column', borderRadius: 2, overflow: 'hidden', minHeight: 2, justifyContent: 'flex-end' },
  barToday: { borderRadius: 3, borderWidth: 1.5, borderColor: colors.gold },
  barEmpty: { height: 2, backgroundColor: colors.lineSoft },
  xaxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { fontSize: 10, color: colors.dim, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10.5, color: colors.muted, fontWeight: '600' },

  summary: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  statLabel: { ...type.caption, color: colors.muted },
  statValue: { ...type.heading, color: colors.ink, marginTop: 2 },
  bodyPressed: { opacity: 0.6 },
  detailFooter: { alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  detailFooterText: { ...type.label, color: colors.gold },
  miniNote: { paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  miniNoteText: { ...type.caption, color: colors.muted, textAlign: 'center', lineHeight: 17 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: 7 },
  emptyIcon: { fontSize: 26, opacity: 0.85 },
  emptyTitle: { ...type.bodyStrong, color: colors.ink },
  emptyBody: { ...type.caption, color: colors.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing.md },
});
