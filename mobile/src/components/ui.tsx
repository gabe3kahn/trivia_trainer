import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { CategoryScore, DailyActivity } from '@/src/data/mockData';
import { tapLight, tapMedium } from '@/src/lib/haptics';
import { accentFor, colors, difficultyTier, radius, scoreColor, serifFont, shadow, spacing, type } from '@/src/theme';

type Tone = 'default' | 'gold' | 'teal' | 'green' | 'red' | 'purple';
type IconName = ComponentProps<typeof FontAwesome>['name'];

/* ------------------------------------------------------------------ *
 * Touchable — the single press primitive. Adds a subtle scale/opacity
 * press state and a haptic tick so every tap feels alive.
 * ------------------------------------------------------------------ */
function Touchable({
  children,
  onPress,
  style,
  disabled,
  haptic = 'light',
}: PropsWithChildren<{
  onPress?: () => void;
  style?: object | object[];
  disabled?: boolean;
  haptic?: 'light' | 'medium' | 'none';
}>) {
  const handlePress = onPress
    ? () => {
        if (haptic === 'medium') tapMedium();
        else if (haptic === 'light') tapLight();
        onPress();
      }
    : undefined;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        style as object,
        pressed && handlePress ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */
export function Screen({ children, contentStyle }: PropsWithChildren<{ contentStyle?: object }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.screen, contentStyle]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Header({ kicker, title, right, logo }: { kicker?: string; title: string; right?: ReactNode; logo?: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {logo ? (
          <Image source={require('../../assets/images/wordmark.png')} style={styles.headerLogo} resizeMode="contain" />
        ) : kicker ? (
          <Text style={styles.kicker}>{kicker}</Text>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Avatar({ label = 'G' }: { label?: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, right, children }: PropsWithChildren<{ title: string; right?: ReactNode }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Pill
 * ------------------------------------------------------------------ */
export function Pill({ children, tone = 'default' }: PropsWithChildren<{ tone?: Tone }>) {
  return (
    <View style={[styles.pill, toneBg[tone]]}>
      <Text style={[styles.pillText, toneInk[tone]]}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ScoreRing — a real arc that fills with `progress` (0..1) and colors
 * by `tone`. `display` is the text in the center.
 * ------------------------------------------------------------------ */
export function ScoreRing({
  display,
  progress = 0,
  label,
  tone = colors.gold,
  size = 116,
}: {
  display: string | number;
  progress?: number;
  label?: string;
  tone?: string;
  size?: number;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.scoreRingWrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tone}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={styles.scoreRingText}>{display}</Text>
      </View>
      {label ? <Text style={styles.scoreRingLabel}>{label}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * DifficultyPips — 1–5 pip meter + tier word. Replaces the Jeopardy $
 * value as the difficulty signal (rank already lives on every question).
 * ------------------------------------------------------------------ */
export function DifficultyPips({ rank, tone = colors.gold }: { rank: number; tone?: string }) {
  return (
    <View style={styles.pipsWrap}>
      <View style={styles.pips}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.pip, i <= rank ? { backgroundColor: tone } : null]} />
        ))}
      </View>
      <Text style={styles.pipLabel}>{difficultyTier(rank)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ClueCard — the redesigned clue surface (replaces the blue Jeopardy
 * board). Dark card, a per-category accent rail + label, the clue set
 * in a serif, and the 1–5 difficulty pips. Optional image for visual
 * clues. Grading UI stays in the screen; this is presentation only.
 * ------------------------------------------------------------------ */
export function ClueCard({
  categoryId,
  categoryName,
  subcategoryName,
  rank,
  clue,
  imageUrl,
}: {
  categoryId?: string | null;
  categoryName: string;
  subcategoryName?: string | null;
  rank: number;
  clue: string;
  imageUrl?: string | null;
}) {
  const accent = accentFor(categoryId);
  return (
    <View style={styles.clueCard}>
      <View style={[styles.clueRail, { backgroundColor: accent }]} />
      <View style={styles.clueHead}>
        <View style={styles.flex}>
          <View style={styles.clueCatRow}>
            <View style={[styles.clueDot, { backgroundColor: accent }]} />
            <Text style={[styles.clueCat, { color: accent }]} numberOfLines={1}>
              {categoryName}
            </Text>
          </View>
          {subcategoryName ? <Text style={styles.clueSub}>{subcategoryName}</Text> : null}
        </View>
        <DifficultyPips rank={rank} tone={accent} />
      </View>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.clueImage} resizeMode="contain" /> : null}
      <Text style={styles.clueText}>{clue}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.gold }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * MetricCard — used on Daily / Profile for glanceable numbers.
 * ------------------------------------------------------------------ */
export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * CategoryScoreRow — tappable. Title + trend + score + chevron, a
 * progress bar, and one compact meta line. No separate badge box.
 * ------------------------------------------------------------------ */
export function CategoryScoreRow({ category, onPress }: { category: CategoryScore; onPress?: () => void }) {
  const color = scoreColor(category.score);
  const up = category.sevenDayDelta > 0;
  const down = category.sevenDayDelta < 0;
  // Low evidence: the score is still settling, so flag it as provisional.
  const building = category.attempts > 0 && category.attempts < 8;

  const meta = [
    building ? 'Building' : category.tier,
    `${category.correctRate}% accuracy`,
    category.dueReview > 0 ? `${category.dueReview} to review` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Touchable onPress={onPress} style={styles.categoryRow}>
      <View style={styles.categoryMain}>
        <View style={styles.rowBetween}>
          <Text style={styles.categoryName} numberOfLines={1}>
            {category.name}
          </Text>
          <View style={styles.categoryRight}>
            {category.sevenDayDelta !== 0 ? (
              <Text style={[styles.trend, up && styles.trendUp, down && styles.trendDown]}>
                {up ? '▲' : '▼'} {Math.abs(category.sevenDayDelta)}
              </Text>
            ) : null}
            <Text style={[styles.categoryScore, { color }, building && styles.categoryScoreBuilding]}>
              {category.score}
            </Text>
            {onPress ? <FontAwesome name="angle-right" size={18} color={colors.dim} /> : null}
          </View>
        </View>
        <ProgressBar value={category.score} color={color} />
        <Text style={styles.categoryMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Touchable>
  );
}

/* ------------------------------------------------------------------ *
 * PrimaryAction — the one prominent CTA per screen (e.g. Home's
 * "Train your weak spots").
 * ------------------------------------------------------------------ */
export function PrimaryAction({
  title,
  subtitle,
  icon = 'bolt',
  loading,
  onPress,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon?: IconName;
  loading?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Touchable onPress={onPress} haptic="medium" disabled={disabled} style={styles.primaryAction}>
      <View style={styles.primaryIcon}>
        <FontAwesome name={icon} size={18} color={colors.gold} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.primaryTitle}>{title}</Text>
        <Text style={styles.primarySubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.gold} />
      ) : (
        <FontAwesome name="angle-right" size={22} color={colors.gold} />
      )}
    </Touchable>
  );
}

/* ------------------------------------------------------------------ *
 * ModeCard — secondary training options. icon + text + trailing pill.
 * ------------------------------------------------------------------ */
export function ModeCard({
  title,
  subtitle,
  label,
  icon,
  tone = 'teal',
  onPress,
  disabled,
}: {
  title: string;
  subtitle: string;
  label: string;
  icon?: IconName;
  tone?: Tone;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Touchable onPress={onPress} disabled={disabled} style={styles.modeCard}>
      {icon ? (
        <View style={styles.modeIcon}>
          <FontAwesome name={icon} size={16} color={colors.muted} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Pill tone={tone}>{label}</Pill>
    </Touchable>
  );
}

/* ------------------------------------------------------------------ *
 * CalendarHeatmap
 * ------------------------------------------------------------------ */
export function CalendarHeatmap({ values }: { values: DailyActivity[] }) {
  return (
    <View style={styles.calendar}>
      {values.map((value, index) => (
        <View
          key={`${value.day}-${index}`}
          style={[styles.calendarDay, calendarStyle(value.reps), value.reviewCleared && styles.calendarReview]}
        >
          <Text style={[styles.calendarText, value.reps >= 30 && styles.calendarTextStrong]}>{value.day}</Text>
          {value.challengePlayed ? <View style={styles.challengeDot} /> : null}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * BadgeCard
 * ------------------------------------------------------------------ */
export function BadgeCard({ name, description, earned }: { name: string; description: string; earned: boolean }) {
  return (
    <Card style={[styles.badgeCard, !earned && styles.badgeLocked]}>
      <View style={[styles.badgeIcon, earned && styles.badgeIconEarned]}>
        <FontAwesome name={earned ? 'trophy' : 'lock'} size={14} color={earned ? colors.gold : colors.dim} />
      </View>
      <Text style={styles.badgeName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.badgeDescription} numberOfLines={2}>
        {description}
      </Text>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * BulletList — real dots, not literal asterisks.
 * ------------------------------------------------------------------ */
export function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ManagementRow — Profile settings rows. A row with no onPress renders
 * a muted "soon" tag instead of a tappable pill.
 * ------------------------------------------------------------------ */
export function ManagementRow({
  title,
  detail,
  action,
  destructive,
  onPress,
}: {
  title: string;
  detail: string;
  action: string;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Touchable onPress={onPress} style={styles.managementRow}>
      <View style={styles.flex}>
        <Text style={[styles.modeTitle, destructive && styles.destructiveText]}>{title}</Text>
        <Text style={styles.modeSubtitle} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {onPress ? (
        <Pill tone={destructive ? 'red' : 'default'}>{action}</Pill>
      ) : (
        <Text style={styles.soonText}>{action}</Text>
      )}
    </Touchable>
  );
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */
function calendarStyle(reps: number) {
  if (reps >= 30) return styles.calendarGoal;
  if (reps >= 10) return styles.calendarLight;
  if (reps > 0) return styles.calendarTiny;
  return null;
}

const toneBg = StyleSheet.create({
  default: { backgroundColor: colors.surfaceAlt },
  gold: { backgroundColor: colors.goldSoft },
  teal: { backgroundColor: colors.tealSoft },
  green: { backgroundColor: colors.greenSoft },
  red: { backgroundColor: colors.redSoft },
  purple: { backgroundColor: colors.purpleSoft },
});

const toneInk = StyleSheet.create({
  default: { color: colors.muted },
  gold: { color: colors.gold },
  teal: { color: colors.teal },
  green: { color: colors.green },
  red: { color: colors.red },
  purple: { color: colors.purple },
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    padding: spacing.md,
    paddingBottom: 120,
    gap: spacing.md,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  kicker: {
    ...type.overline,
    color: colors.gold,
  },
  headerLogo: {
    height: 34,
    aspectRatio: 2.5,
    marginBottom: 2,
  },
  title: {
    ...type.display,
    color: colors.ink,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevated,
  },
  avatarText: {
    ...type.bodyStrong,
    color: colors.gold,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadow.card,
  },

  section: {
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...type.overline,
    color: colors.muted,
  },

  pill: {
    minHeight: 26,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pillText: {
    ...type.caption,
  },

  scoreRingWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreRingText: {
    ...type.title,
    fontSize: 30,
    color: colors.ink,
  },
  scoreRingLabel: {
    ...type.overline,
    color: colors.muted,
  },

  pipsWrap: {
    alignItems: 'flex-end',
    gap: 5,
  },
  pips: {
    flexDirection: 'row',
    gap: 4,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
  },
  pipLabel: {
    ...type.overline,
    color: colors.muted,
  },

  clueCard: {
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    overflow: 'hidden',
    ...shadow.card,
  },
  clueRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  clueHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  clueCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clueDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  clueCat: {
    ...type.overline,
  },
  clueSub: {
    ...type.caption,
    color: colors.muted,
    marginTop: 3,
  },
  clueImage: {
    width: '100%',
    height: 196,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
  },
  clueText: {
    fontFamily: serifFont,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '500',
    color: colors.ink,
    marginTop: spacing.md,
  },

  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: radius.pill,
  },

  metricCard: {
    flex: 1,
    minHeight: 84,
    backgroundColor: colors.elevated,
    gap: 4,
  },
  metricLabel: {
    ...type.overline,
    color: colors.muted,
  },
  metricValue: {
    ...type.title,
    color: colors.ink,
  },
  metricDetail: {
    ...type.caption,
    color: colors.muted,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  categoryMain: {
    flex: 1,
    gap: spacing.xs + 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryName: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trend: {
    ...type.caption,
    color: colors.muted,
  },
  trendUp: {
    color: colors.green,
  },
  trendDown: {
    color: colors.red,
  },
  categoryScore: {
    ...type.heading,
    minWidth: 26,
    textAlign: 'right',
  },
  categoryScoreBuilding: {
    opacity: 0.6,
  },
  categoryMeta: {
    ...type.caption,
    color: colors.muted,
  },

  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
    padding: spacing.md + 2,
  },
  primaryIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(242,184,75,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTitle: {
    ...type.heading,
    color: colors.ink,
  },
  primarySubtitle: {
    ...type.caption,
    color: colors.gold,
    marginTop: 2,
  },

  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  modeIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  modeSubtitle: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },

  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  calendarDay: {
    width: '12.7%',
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTiny: {
    backgroundColor: colors.surfaceAlt,
  },
  calendarLight: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  calendarGoal: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  calendarReview: {
    borderBottomWidth: 3,
    borderBottomColor: colors.teal,
  },
  calendarText: {
    ...type.caption,
    color: colors.muted,
  },
  calendarTextStrong: {
    color: colors.background,
  },
  challengeDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.purple,
  },

  badgeCard: {
    width: '48.4%',
    gap: spacing.xs,
    backgroundColor: colors.elevated,
  },
  badgeLocked: {
    opacity: 0.55,
  },
  badgeIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  badgeIconEarned: {
    backgroundColor: colors.goldSoft,
  },
  badgeName: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  badgeDescription: {
    ...type.caption,
    color: colors.muted,
  },

  bulletList: {
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  bulletText: {
    flex: 1,
    ...type.caption,
    color: colors.muted,
  },

  managementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  destructiveText: {
    color: colors.red,
  },
  soonText: {
    ...type.caption,
    color: colors.dim,
  },
});
