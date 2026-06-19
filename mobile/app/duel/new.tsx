import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Header, Screen } from '@/src/components/ui';
import { tapMedium } from '@/src/lib/haptics';
import { createGame, listFriends } from '@/src/services/triviaApi';
import { colors, radius, spacing, type } from '@/src/theme';
import type { FriendRow } from '@/src/types/supabase';

// Phase 1: pick a friend → a 6-clue mixed duel. Formats (category / larger / hard)
// come later (create_game already takes count/categories/mechanics).
export default function NewDuelScreen() {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setFriends(await listFriends()); }
      catch (e) { Alert.alert('Could not load friends', e instanceof Error ? e.message : 'Try again.'); }
      finally { setLoading(false); }
    })();
  }, []);

  async function challenge(f: FriendRow) {
    if (starting) return;
    try {
      setStarting(f.id);
      tapMedium();
      const gameId = await createGame({ opponentId: f.id, count: 6 });
      router.replace(`/duel/${gameId}` as any);
    } catch (e) {
      setStarting(null);
      Alert.alert('Could not start duel', e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <Screen>
      <Header kicker="Compete" title="New duel" />
      <Text style={styles.sub}>Challenge a friend to a 6-clue head-to-head. Same set for both of you, 30 seconds per clue.</Text>
      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />
      ) : friends.length === 0 ? (
        <Text style={styles.empty}>No friends yet. Add some from the Compete tab, then come back to start a duel.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {friends.map((f) => (
            <Pressable key={f.id} onPress={() => challenge(f)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.ava}><Text style={styles.avaInk}>{(f.display_name ?? f.username ?? '?').trim().charAt(0).toUpperCase()}</Text></View>
              <Text style={styles.name} numberOfLines={1}>{f.display_name ?? f.username}</Text>
              {starting === f.id ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.cta}>Challenge</Text>}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...type.body, color: colors.muted, marginBottom: spacing.sm },
  empty: { ...type.body, color: colors.dim, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  ava: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  avaInk: { ...type.label, color: colors.background, fontWeight: '800' },
  name: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  cta: { ...type.label, color: colors.teal, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
