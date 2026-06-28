import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, CategoryScoreRow, Header, ManagementRow, MetricCard, ScoreRing, Screen, Section } from '@/src/components/ui';
import type { CategoryScore } from '@/src/data/mockData';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchCategories, fetchEarnedBadges, fetchHomeCompetencies, fetchProfile } from '@/src/services/triviaApi';
import { colors, scoreColor, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type EarnedBadge = Database['public']['Tables']['user_badges']['Row'];
type Competency = Database['public']['Tables']['category_competencies']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [overallScore, setOverallScore] = useState(0);
  const [overallTier, setOverallTier] = useState('novice');
  const [strongCount, setStrongCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const [profileRow, earnedRows, competencyData, categoryRows] = await Promise.all([
        fetchProfile(),
        fetchEarnedBadges(),
        fetchHomeCompetencies(),
        fetchCategories(),
      ]);

      const competencyRows = (competencyData ?? []) as Competency[];
      const overall = competencyRows.find((item) => item.dimension_type === 'overall');
      const categoryComps = competencyRows.filter((item) => item.dimension_type === 'category');

      setProfile(profileRow);
      setEarnedBadges(earnedRows ?? []);
      setCategories(categoryRows ?? []);
      setCompetencies(competencyRows);
      setAttempts(overall?.attempts ?? 0);
      setOverallScore(overall?.score ?? 0);
      setOverallTier(overall?.tier ?? 'novice');
      setStrongCount(categoryComps.filter((item) => item.score >= 75).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Player';

  // Below the overall confidence threshold, show a "Getting started" placement instead
  // of a score that's mostly evidence-shrink (matches Home + migration 011's overall K).
  const OVERALL_MAPPED_AT = 15;
  const placed = attempts >= OVERALL_MAPPED_AT;
  const repsToMap = Math.max(0, OVERALL_MAPPED_AT - attempts);

  // Per-category competency rows (moved here from Home so Home stays a launchpad).
  const categoryRows = useMemo(() => {
    const byKey = new Map(
      competencies.filter((item) => item.dimension_type === 'category').map((item) => [item.dimension_key, item]),
    );
    // words_language competency is merged into language_wordplay (migration 016),
    // so it has no row of its own — hide it rather than show a misleading 0.
    return categories
      .filter((category) => category.id !== 'words_language')
      .map<CategoryScore>((category) => {
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

  return (
    <Screen>
      <Header kicker="Profile" title={displayName} right={<Avatar label={displayName.charAt(0).toUpperCase()} />} />

      <Card style={styles.identityCard}>
        {placed ? (
          <ScoreRing display={overallScore} progress={overallScore / 100} tone={scoreColor(overallScore)} label="overall" />
        ) : (
          <ScoreRing display={attempts} progress={attempts / OVERALL_MAPPED_AT} tone={colors.gold} label={`of ${OVERALL_MAPPED_AT} reps`} />
        )}
        <View style={styles.identityText}>
          <Text style={styles.tier}>{placed ? formatTier(overallTier) : 'Getting started'}</Text>
          <Text style={styles.identityDetail}>
            {placed
              ? `${strongCount} Strong+ categor${strongCount === 1 ? 'y' : 'ies'}`
              : repsToMap === 0
                ? 'Mapping your level…'
                : `${repsToMap} more reps to find your level`}
          </Text>
        </View>
      </Card>

      <MetricCard
        label="Badges"
        value={`${earnedBadges.length} earned`}
        detail="View all"
        onPress={() => router.push('/badges' as never)}
      />

      <Section title="Categories">
        {loading && categoryRows.length === 0 ? <ActivityIndicator color={colors.gold} /> : null}
        {categoryRows.map((category) => (
          <CategoryScoreRow key={category.id} category={category} />
        ))}
      </Section>

      <Section title="Account">
        <ManagementRow title="Email" detail={profile?.email ?? user?.email ?? 'Signed in'} action="Synced" />
        <ManagementRow title="Export data" detail="Attempts, scores, badges" action="Soon" />
        <ManagementRow title="Sign out" detail="End this session" action="Sign out" destructive onPress={signOut} />
      </Section>
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
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityText: {
    flex: 1,
    gap: 4,
  },
  tier: {
    ...type.title,
    color: colors.ink,
  },
  identityDetail: {
    ...type.caption,
    color: colors.muted,
  },
});
