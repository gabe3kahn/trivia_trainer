import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar, BadgeCard, Card, Header, ManagementRow, MetricCard, Pill, ScoreRing, Screen, Section } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchBadges, fetchEarnedBadges, fetchHomeCompetencies, fetchProfile } from '@/src/services/triviaApi';
import { colors, scoreColor, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Badge = Database['public']['Tables']['badges']['Row'];
type EarnedBadge = Database['public']['Tables']['user_badges']['Row'];
type Competency = Database['public']['Tables']['category_competencies']['Row'];

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [overallScore, setOverallScore] = useState(0);
  const [overallTier, setOverallTier] = useState('unmapped');
  const [strongCount, setStrongCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const [profileRow, badgeRows, earnedRows, competencies] = await Promise.all([
        fetchProfile(),
        fetchBadges(),
        fetchEarnedBadges(),
        fetchHomeCompetencies(),
      ]);

      const competencyRows = (competencies ?? []) as Competency[];
      const overall = competencyRows.find((item) => item.dimension_type === 'overall');
      const categories = competencyRows.filter((item) => item.dimension_type === 'category');

      setProfile(profileRow);
      setBadges(badgeRows ?? []);
      setEarnedBadges(earnedRows ?? []);
      setAttempts(overall?.attempts ?? 0);
      setOverallScore(overall?.score ?? 0);
      setOverallTier(overall?.tier ?? 'unmapped');
      setStrongCount(categories.filter((item) => item.score >= 75).length);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const earnedKeys = useMemo(() => new Set(earnedBadges.map((badge) => badge.badge_key)), [earnedBadges]);
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Player';
  const visibleBadges = badges.slice(0, 6).map((badge) => ({
    name: badge.name,
    description: badge.description,
    earned: earnedKeys.has(badge.key),
  }));

  const confidence =
    attempts >= 50
      ? { label: 'High confidence', tone: 'green' as const }
      : attempts >= 15
        ? { label: 'Building confidence', tone: 'gold' as const }
        : { label: 'Low confidence', tone: 'default' as const };

  return (
    <Screen>
      <Header kicker="Profile" title={displayName} right={<Avatar label={displayName.charAt(0).toUpperCase()} />} />

      <Card style={styles.identityCard}>
        <ScoreRing display={overallScore} progress={overallScore / 100} tone={scoreColor(overallScore)} label="overall" />
        <View style={styles.identityText}>
          <Text style={styles.tier}>{formatTier(overallTier)}</Text>
          <Text style={styles.identityDetail}>Competency across {strongCount > 0 ? `${strongCount} strong ` : ''}categories</Text>
          <View style={styles.pillRow}>
            <Pill tone={confidence.tone}>{confidence.label}</Pill>
          </View>
        </View>
      </Card>

      <View style={styles.metricRow}>
        <MetricCard label="Reps" value={String(attempts)} />
        <MetricCard label="Strong+" value={String(strongCount)} detail="categories" />
        <MetricCard label="Badges" value={String(earnedBadges.length)} />
      </View>

      <Section title="Badges" right={<Text style={styles.countText}>{earnedBadges.length} earned</Text>}>
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        <View style={styles.badgeGrid}>
          {visibleBadges.map((badge) => (
            <BadgeCard key={badge.name} {...badge} />
          ))}
        </View>
      </Section>

      <Section title="Account">
        <ManagementRow title="Email" detail={profile?.email ?? user?.email ?? 'Signed in'} action="Synced" />
        <ManagementRow title="Export data" detail="Attempts, scores, badges" action="Soon" />
        <ManagementRow title="Friends" detail="Requests and invites" action="Soon" />
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
  pillRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  countText: {
    ...type.caption,
    color: colors.muted,
  },
});
