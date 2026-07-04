import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChallengePlayer } from '@/src/components/ChallengePlayer';
import { Card, Header, Pill, PrimaryAction, Screen, Section } from '@/src/components/ui';
import { tapMedium } from '@/src/lib/haptics';
import {
  createInvite, getDailyChallenge, getDailyLeaderboard, getDailyStreak,
  listFriends, listGames, listSentFriendRequests, respondFriendRequest, searchUsers, sendFriendRequest, submitDailyRun,
} from '@/src/services/triviaApi';
import { supabase } from '@/src/services/supabase';
import { colors, radius, spacing, type } from '@/src/theme';
import type { DailyChallenge, FriendRow, GameSummary, LeaderboardRow, UserSearchRow } from '@/src/types/supabase';

export default function CompeteScreen() {
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState(0);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [pending, setPending] = useState<{ id: string; name: string }[]>([]);
  const [sent, setSent] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserSearchRow[]>([]);

  const load = useCallback(async () => {
    try {
      const [d, s, lb, g, fr] = await Promise.all([
        getDailyChallenge(), getDailyStreak(), getDailyLeaderboard(), listGames(), listFriends(),
      ]);
      setDaily(d); setStreak(s); setBoard(lb); setGames(g); setFriends(fr);
      await Promise.all([loadPending(), loadSent()]);
    } catch (e) {
      Alert.alert('Could not load Compete', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Pending incoming requests. Use the SECURITY DEFINER RPC rather than reading profiles
  // directly — RLS hides the requester's profile until you're friends, which made every
  // request render as "Someone".
  async function loadPending() {
    const { data } = await (supabase.rpc as any)('list_friend_requests');
    setPending((data ?? []).map((r: any) => ({ id: r.id, name: r.display_name ?? r.username ?? 'Someone' })));
  }

  // Outgoing (sent) pending invites — refreshed on load and right after sending one.
  async function loadSent() {
    const rows = await listSentFriendRequests();
    setSent((rows ?? []).map((r) => ({ id: r.id, name: r.display_name ?? r.username ?? 'Someone' })));
  }

  // Re-focus refetch, but skip if we loaded very recently — switching tabs back
  // and forth shouldn't fire 6 network calls each time. Friend/daily actions
  // call load() explicitly, so this only debounces the passive focus refetch.
  const lastLoad = useRef(0);
  useFocusEffect(useCallback(() => {
    if (Date.now() - lastLoad.current < 20000) return;
    lastLoad.current = Date.now();
    void load();
  }, [load]));

  const answered = daily?.my_attempts.length ?? 0;
  const setSize = daily?.set_size ?? 0;
  const dailyDone = !!daily?.completed;
  const activeGames = games.filter((g) => g.status !== 'completed' && g.status !== 'expired');

  async function runSearch(text: string) {
    setQ(text);
    if (text.trim().length < 2) { setResults([]); return; }
    try { setResults(await searchUsers(text.trim())); } catch { /* ignore transient */ }
  }
  async function addFriend(u: UserSearchRow) {
    try { await sendFriendRequest(u.id); Alert.alert('Request sent', `Friend request sent to ${u.display_name ?? u.username}.`); void runSearch(q); void loadSent(); }
    catch (e) { Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.'); }
  }
  async function respond(id: string, accept: boolean) {
    try { await respondFriendRequest(id, accept); await load(); }
    catch (e) { Alert.alert('Could not respond', e instanceof Error ? e.message : 'Try again.'); }
  }
  async function shareInvite() {
    try { const token = await createInvite(); await Share.share({ message: `Play trivia with me — open the app and redeem invite ${token}` }); }
    catch (e) { Alert.alert('Could not create invite', e instanceof Error ? e.message : 'Try again.'); }
  }

  /* ---- Playing the daily challenge (inline) ---- */
  if (playing && daily) {
    const answeredIds = new Set(daily.my_attempts.map((a) => a.question_id));
    const remaining = daily.questions.filter((qq) => !answeredIds.has(qq.id));
    return (
      <ChallengePlayer
        questions={remaining}
        secondsPerQuestion={daily.seconds_per_question}
        onComplete={async (attempts) => {
          try {
            await submitDailyRun(
              daily.challenge_date,
              attempts.map((a) => ({ questionId: a.question.id, response: a.response, grade: a.grade, timeMs: a.timeMs })),
            );
          } catch (e) {
            Alert.alert('Could not save your challenge', e instanceof Error ? e.message : 'Try again.');
            throw e; // keep the player on Finish for a retry
          }
          setPlaying(false);
          await load();
        }}
      />
    );
  }

  if (loading) {
    return <Screen><Header kicker="Compete" title="Compete" /><ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} /></Screen>;
  }

  return (
    <Screen keyboardAware>
      <Header kicker="Compete" title="Compete" right={streak > 0 ? <Pill tone="gold">{`🔥 ${streak}`}</Pill> : undefined} />

      {/* Daily Challenge hero */}
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroKicker}>TODAY'S CHALLENGE</Text>
          <Pill tone={dailyDone ? 'teal' : 'gold'}>{dailyDone ? 'Done' : `${answered}/${setSize}`}</Pill>
        </View>
        <Text style={styles.heroTitle}>{setSize} clues · 30s each</Text>
        <Text style={styles.heroSub}>
          {dailyDone ? 'You’ve played today. Come back after midnight PT for a fresh set.'
            : answered > 0 ? `Resume where you left off — ${setSize - answered} to go.`
            : 'One shared set for everyone. Beat your friends on score, then speed.'}
        </Text>
        <PrimaryAction
          title={dailyDone ? 'Review today’s set' : answered > 0 ? 'Resume challenge' : 'Play daily challenge'}
          subtitle={dailyDone ? 'See the clues again' : 'Timer starts on each clue'}
          icon="bolt"
          disabled={setSize === 0 || dailyDone}
          onPress={() => { tapMedium(); setPlaying(true); }}
        />
      </Card>

      {/* Today's leaderboard */}
      {board.length > 0 ? (
        <Section title="Today's leaderboard">
          {board.map((r, i) => (
            <View key={r.user_id} style={[styles.lbRow, r.is_me && styles.lbMe]}>
              <Text style={styles.lbRank}>{i + 1}</Text>
              <Text style={[styles.lbName, r.is_me && { color: colors.gold }]} numberOfLines={1}>
                {r.display_name ?? r.username ?? 'Player'}{r.is_me ? ' (you)' : ''}
              </Text>
              <Text style={styles.lbMeta}>{r.correct}/{setSize}</Text>
              <Text style={styles.lbScore}>{r.score}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {/* Duels — active only inline; completed ones live behind History so the list
          doesn't pile up. */}
      <Section
        title="Duels"
        right={
          <View style={styles.sectionLinks}>
            {games.some((g) => g.status === 'completed' || g.status === 'expired') ? (
              <Pressable onPress={() => router.push('/duel/history' as any)}><Text style={styles.link}>History</Text></Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/duel/new' as any)}><Text style={styles.link}>New</Text></Pressable>
          </View>
        }
      >
        {activeGames.length === 0 ? (
          <Text style={styles.empty}>No active duels. Challenge a friend to a 6-clue head-to-head.</Text>
        ) : activeGames.map((g) => (
          <Pressable key={g.id} onPress={() => router.push(`/duel/${g.id}` as any)} style={({ pressed }) => [styles.duelRow, pressed && styles.duelPressed]}>
            <View style={styles.flex}>
              <Text style={styles.duelName} numberOfLines={1}>{g.opponent_name ?? g.opponent_username ?? 'Opponent'}</Text>
              <Text style={styles.duelMeta}>
                {g.status === 'completed'
                  ? (g.winner_id == null ? 'Draw' : g.winner_id === g.opponent_id ? 'You lost' : 'You won')
                  : g.your_turn ? `Your turn · ${g.my_answered}/${g.set_size}` : `Waiting · ${g.their_answered}/${g.set_size}`}
              </Text>
            </View>
            <Pill tone={g.status === 'completed' ? 'teal' : g.your_turn ? 'gold' : 'default'}>
              {g.status === 'completed' ? `${g.creator_score}–${g.opponent_score}` : g.your_turn ? 'Play' : 'Sent'}
            </Pill>
          </Pressable>
        ))}
      </Section>

      {/* Friends */}
      <Section title="Friends" right={<Pressable onPress={shareInvite}><Text style={styles.link}>Invite</Text></Pressable>}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={runSearch}
          placeholder="Find players by name or @username"
          placeholderTextColor={colors.dim}
          autoCapitalize="none"
        />
        {results.map((u) => (
          <View key={u.id} style={styles.friendRow}>
            <Text style={styles.friendName} numberOfLines={1}>{u.display_name ?? u.username}</Text>
            {u.status === 'accepted' ? <Pill tone="teal">Friends</Pill>
              : u.status === 'pending' ? <Pill>Pending</Pill>
              : <Pressable onPress={() => addFriend(u)}><Text style={styles.link}>Add</Text></Pressable>}
          </View>
        ))}

        {pending.length > 0 ? (
          <>
            <Text style={styles.subhead}>Requests</Text>
            {pending.map((p) => (
              <View key={p.id} style={styles.friendRow}>
                <Text style={styles.friendName} numberOfLines={1}>{p.name}</Text>
                <View style={styles.reqBtns}>
                  <Pressable onPress={() => respond(p.id, true)}><Text style={[styles.link, { color: colors.green }]}>Accept</Text></Pressable>
                  <Pressable onPress={() => respond(p.id, false)}><Text style={[styles.link, { color: colors.red }]}>Ignore</Text></Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {sent.length > 0 && results.length === 0 ? (
          <>
            <Text style={styles.subhead}>Sent</Text>
            {sent.map((s) => (
              <View key={s.id} style={styles.friendRow}>
                <Text style={styles.friendName} numberOfLines={1}>{s.name}</Text>
                <Pill>Pending</Pill>
              </View>
            ))}
          </>
        ) : null}

        {friends.length > 0 && results.length === 0 ? (
          <>
            <Text style={styles.subhead}>Your friends</Text>
            {friends.map((f) => (
              <View key={f.id} style={styles.friendRow}>
                <Text style={styles.friendName} numberOfLines={1}>{f.display_name ?? f.username}</Text>
              </View>
            ))}
          </>
        ) : friends.length === 0 && results.length === 0 ? (
          <Text style={styles.empty}>No friends yet. Search above or share an invite link.</Text>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { ...type.overline, color: colors.gold },
  heroTitle: { ...type.title, color: colors.ink },
  heroSub: { ...type.body, color: colors.muted },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  lbMe: { backgroundColor: colors.elevated, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  lbRank: { ...type.label, color: colors.dim, width: 22 },
  lbName: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  lbMeta: { ...type.caption, color: colors.muted, width: 44, textAlign: 'right' },
  lbScore: { ...type.bodyStrong, color: colors.gold, width: 56, textAlign: 'right' },
  duelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  duelPressed: { opacity: 0.6 },
  duelName: { ...type.bodyStrong, color: colors.ink },
  duelMeta: { ...type.caption, color: colors.muted },
  search: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.md, ...type.body },
  friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 10 },
  friendName: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  reqBtns: { flexDirection: 'row', gap: spacing.md },
  subhead: { ...type.overline, color: colors.muted, marginTop: spacing.sm },
  link: { ...type.label, color: colors.teal },
  sectionLinks: { flexDirection: 'row', gap: spacing.md },
  empty: { ...type.body, color: colors.dim },
});
