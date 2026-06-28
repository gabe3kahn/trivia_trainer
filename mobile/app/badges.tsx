import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { badgeIcon, tierColor } from '@/src/constants/badges';
import { fetchBadges, fetchEarnedBadges } from '@/src/services/triviaApi';
import { colors, radius, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Badge = Database['public']['Tables']['badges']['Row'];

const TIER_RANK: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

export default function BadgesScreen() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [all, mine] = await Promise.all([fetchBadges(), fetchEarnedBadges()]);
      setBadges((all ?? []) as Badge[]);
      setEarned(new Set(((mine ?? []) as { badge_key: string }[]).map((b) => b.badge_key)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Earned first, then locked; within each group by tier (gold → bronze) then name.
  const sorted = [...badges].sort((a, b) => {
    const ea = earned.has(a.key) ? 0 : 1;
    const eb = earned.has(b.key) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const ta = TIER_RANK[a.tier ?? 'bronze'] ?? 3;
    const tb = TIER_RANK[b.tier ?? 'bronze'] ?? 3;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });
  const earnedCount = badges.filter((b) => earned.has(b.key)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <FontAwesome name="angle-left" size={26} color={colors.muted} />
        </Pressable>
        <Text style={styles.title}>Badges</Text>
        {loading ? null : (
          <Text style={styles.count}>
            {earnedCount}/{badges.length}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} /> : null}
        {sorted.map((b) => {
          const got = earned.has(b.key);
          const tc = tierColor(b.tier);
          return (
            <View key={b.key} style={[styles.row, !got && styles.rowLocked]}>
              <View
                style={[
                  styles.iconWrap,
                  { borderColor: got ? tc : colors.line, backgroundColor: got ? tc + '22' : colors.surfaceAlt },
                ]}
              >
                <Text style={styles.icon}>{got ? badgeIcon(b.key) : '🔒'}</Text>
              </View>
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, !got && styles.dim]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <View style={[styles.tierPill, { borderColor: got ? tc : colors.line }]}>
                    <Text style={[styles.tierText, { color: got ? tc : colors.dim }]}>
                      {(b.tier ?? 'bronze').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.desc} numberOfLines={2}>
                  {b.description}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  title: { ...type.title, color: colors.ink, flex: 1 },
  count: { ...type.label, color: colors.muted },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowLocked: { opacity: 0.6 },
  iconWrap: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 26 },
  rowMain: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  dim: { color: colors.muted },
  tierPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tierText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  desc: { ...type.caption, color: colors.muted, lineHeight: 17 },
});
