import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActivityChart, StreakStrip } from '@/src/components/activity';
import { Avatar, Card, Header, PrimaryAction, ScoreRing, Screen, Section } from '@/src/components/ui';
import type { CategoryScore } from '@/src/data/mockData';
import {
  fetchCategories,
  fetchHomeCompetencies,
  getActivitySummary,
  getDailyStreak,
  type ActivityDay,
} from '@/src/services/triviaApi';
import { colors, scoreColor, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Category = Database['public']['Tables']['categories']['Row'];
type Competency = Database['public']['Tables']['category_competencies']['Row'];

export default function HomeScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [activityDaily, setActivityDaily] = useState<ActivityDay[]>([]);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    try {
      setError(null);
      const [categoryRows, competencyRows, summary, streakCount] = await Promise.all([
        fetchCategories(),
        fetchHomeCompetencies(),
        getActivitySummary(30),
        getDailyStreak(),
      ]);
      setCategories(categoryRows ?? []);
      setCompetencies(competencyRows ?? []);
      setActivityDaily(summary.daily ?? []);
      setStreak(streakCount ?? 0);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load home data.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHome();
    }, [loadHome]),
  );

  const overallRow = competencies.find((item) => item.dimension_type === 'overall');

  const categoryRows = useMemo(() => {
    const byKey = new Map(
      competencies.filter((item) => item.dimension_type === 'category').map((item) => [item.dimension_key, item]),
    );

    return categories.map<CategoryScore>((category) => {
      const score = byKey.get(category.id);
      return {
        id: category.id,
        name: category.name,
        score: score?.score ?? 0,
        tier: formatTier(score?.tier ?? 'novice'),
        sevenDayDelta: score?.seven_day_delta ?? 0,
        attempts: score?.attempts ?? 0,
        correctRate: Math.round(Number(score?.correct_rate ?? 0)),
        avgCorrectValue: score?.avg_correct_value ?? 0,
        dueReview: score?.due_review_count ?? 0,
        backendMetric: 'category_competencies',
      };
    });
  }, [categories, competencies]);

  const overall = overallRow?.score ?? 0;
  const overallDelta = overallRow?.seven_day_delta ?? 0;
  const attempts = overallRow?.attempts ?? categoryRows.reduce((sum, c) => sum + c.attempts, 0);

  // Below this many overall reps the score is mostly evidence-shrink, not skill — so we
  // show a "Getting started" placement (progress to a real read) instead of a low number.
  // Matches the overall K in recalculate_user_competencies (migration 011).
  const OVERALL_MAPPED_AT = 15;
  const placed = attempts >= OVERALL_MAPPED_AT;
  const repsToMap = Math.max(0, OVERALL_MAPPED_AT - attempts);

  const weakest = [...categoryRows]
    .filter((c) => c.attempts > 0 || c.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const weakestNames = (weakest.length ? weakest : categoryRows.slice(-3)).map((c) => c.name).join(' · ');

  const movers = [...categoryRows].filter((c) => c.attempts > 0);
  const riser = movers.reduce<CategoryScore | null>(
    (best, c) => (!best || c.sevenDayDelta > best.sevenDayDelta ? c : best),
    null,
  );
  const dropper = movers.reduce<CategoryScore | null>(
    (worst, c) => (!worst || c.sevenDayDelta < worst.sevenDayDelta ? c : worst),
    null,
  );
  const hasMovement = (riser?.sevenDayDelta ?? 0) > 0 || (dropper?.sevenDayDelta ?? 0) < 0;

  const trendText =
    attempts === 0
      ? 'Start training to map your score'
      : overallDelta > 0
        ? `▲ +${overallDelta} this week`
        : overallDelta < 0
          ? `▼ ${overallDelta} this week`
          : 'Steady this week';

  function startWeakness() {
    router.push({ pathname: '/train', params: { start: 'weakness' } });
  }

  return (
    <Screen>
      <Header logo title="Home" right={<Avatar />} />

      <StreakStrip daily={activityDaily} streak={streak} />

      <Card style={styles.hero}>
        {placed ? (
          <ScoreRing display={overall} progress={overall / 100} tone={scoreColor(overall)} label="overall" />
        ) : (
          <ScoreRing
            display={attempts}
            progress={attempts / OVERALL_MAPPED_AT}
            tone={colors.gold}
            label={`of ${OVERALL_MAPPED_AT} reps`}
          />
        )}
        <View style={styles.heroText}>
          {placed ? (
            <>
              <Text style={styles.heroTier}>{formatTier(overallRow?.tier ?? 'novice')}</Text>
              <Text style={[styles.heroTrend, overallDelta > 0 && styles.up, overallDelta < 0 && styles.down]}>
                {trendText}
              </Text>
              <Text style={styles.heroStat}>{attempts} reps</Text>
            </>
          ) : (
            <>
              <Text style={styles.heroTier}>Getting started</Text>
              <Text style={[styles.heroTrend, { color: colors.gold }]}>
                {repsToMap === 0 ? 'Mapping your level…' : `${repsToMap} more to find your level`}
              </Text>
              <Text style={styles.heroStat}>Your score unlocks once we've got a read</Text>
            </>
          )}
        </View>
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ActivityChart daily={activityDaily} onPressDetail={() => router.push('/activity' as never)} />

      <PrimaryAction
        title={attempts === 0 ? 'Answer your first questions' : 'Train your weak spots'}
        subtitle={attempts === 0 ? 'Pick any category to begin' : weakestNames || 'Build a difficulty-weighted set'}
        onPress={attempts === 0 ? () => router.push({ pathname: '/train' }) : startWeakness}
      />

      {hasMovement ? (
        <Section title="This week">
          <View style={styles.moverRow}>
            {riser && riser.sevenDayDelta > 0 ? (
              <View style={styles.moverCard}>
                <Text style={[styles.moverDelta, styles.up]}>▲ +{riser.sevenDayDelta}</Text>
                <Text style={styles.moverName} numberOfLines={1}>
                  {riser.name}
                </Text>
              </View>
            ) : null}
            {dropper && dropper.sevenDayDelta < 0 ? (
              <View style={styles.moverCard}>
                <Text style={[styles.moverDelta, styles.down]}>▼ {dropper.sevenDayDelta}</Text>
                <Text style={styles.moverName} numberOfLines={1}>
                  {dropper.name}
                </Text>
              </View>
            ) : null}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

function formatTier(tier: string) {
  return tier
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTier: {
    ...type.title,
    color: colors.ink,
  },
  heroTrend: {
    ...type.label,
    color: colors.muted,
  },
  up: {
    color: colors.green,
  },
  down: {
    color: colors.red,
  },
  heroStat: {
    ...type.caption,
    color: colors.muted,
  },
  moverRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moverCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    padding: spacing.md,
    gap: 3,
  },
  moverDelta: {
    ...type.bodyStrong,
  },
  moverName: {
    ...type.caption,
    color: colors.muted,
  },
  errorText: {
    ...type.caption,
    color: colors.red,
  },
});
