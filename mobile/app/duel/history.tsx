import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listGames } from '@/src/services/triviaApi';
import { colors, radius, spacing, type } from '@/src/theme';
import type { GameSummary } from '@/src/types/supabase';

// Finished duels (completed + expired). Active ones stay on the Compete tab; this is the
// pile-up-safe archive reached via the Duels "History" link.
export default function DuelHistoryScreen() {
  const router = useRouter();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const all = await listGames();
      setGames(all.filter((g) => g.status === 'completed' || g.status === 'expired'));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <FontAwesome name="angle-left" size={26} color={colors.muted} />
        </Pressable>
        <Text style={styles.title}>Duel history</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        {loading ? <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} /> : null}
        {!loading && games.length === 0 ? <Text style={styles.empty}>No finished duels yet.</Text> : null}
        {games.map((g) => {
          const result = g.winner_id == null ? 'Draw' : g.winner_id === g.opponent_id ? 'Lost' : 'Won';
          const mine = g.is_creator ? g.creator_score : g.opponent_score;
          const theirs = g.is_creator ? g.opponent_score : g.creator_score;
          const tone = result === 'Won' ? colors.green : result === 'Lost' ? colors.red : colors.muted;
          return (
            <Pressable
              key={g.id}
              onPress={() => router.push(`/duel/${g.id}` as any)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{g.opponent_name ?? g.opponent_username ?? 'Opponent'}</Text>
                <Text style={[styles.result, { color: tone }]}>{result}</Text>
              </View>
              <Text style={styles.score}>{mine}–{theirs}</Text>
              <FontAwesome name="angle-right" size={18} color={colors.dim} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  back: { padding: 4 },
  title: { ...type.title, color: colors.ink },
  body: { padding: spacing.md, paddingBottom: 96, gap: spacing.sm },
  empty: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  name: { ...type.bodyStrong, color: colors.ink },
  result: { ...type.label },
  score: { ...type.heading, color: colors.ink },
});
