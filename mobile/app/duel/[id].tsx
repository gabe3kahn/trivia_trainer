import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChallengePlayer } from '@/src/components/ChallengePlayer';
import { Card, DifficultyPips, Header, Pill, PrimaryAction, Screen } from '@/src/components/ui';
import { tapMedium } from '@/src/lib/haptics';
import { createGame, getGame, submitGameAttempt } from '@/src/services/triviaApi';
import { supabase } from '@/src/services/supabase';
import { accentFor, colors, radius, spacing, type } from '@/src/theme';
import type { AttemptGrade, DailyAttempt, GamePayload } from '@/src/types/supabase';

type Verdict = 'win' | 'loss' | 'draw' | 'waiting';

export default function DuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [game, setGame] = useState<GamePayload | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, u] = await Promise.all([getGame(id), supabase.auth.getUser()]);
      setGame(g);
      setMe(u.data.user?.id ?? null);
    } catch (e) {
      Alert.alert('Could not load duel', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading || !game) {
    return <Screen><Header kicker="Compete" title="Duel" /><ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} /></Screen>;
  }

  const answeredIds = new Set(game.my_attempts.map((a) => a.question_id));
  const myDone = game.my_attempts.length >= game.set_size;
  const isActive = game.status === 'active';
  const finished = game.status === 'completed' || game.status === 'expired';

  /* ---- Playing my run ---- */
  if (isActive && !myDone && playing) {
    const remaining = game.questions.filter((q) => !answeredIds.has(q.id));
    return (
      <ChallengePlayer
        questions={remaining}
        secondsPerQuestion={game.seconds_per_question}
        allowGradeOverride={false}
        onSubmit={async ({ question, response, grade, timeMs }) => {
          await submitGameAttempt({ gameId: game.id, questionId: question.id, response, grade, timeMs });
        }}
        onComplete={async () => { setPlaying(false); await load(); }}
      />
    );
  }

  /* ---- Start gate: my turn, not yet played ---- */
  if (isActive && !myDone) {
    return (
      <Screen>
        <Header kicker="Compete" title="Your turn" right={<Pill tone="gold">{`${game.set_size} clues`}</Pill>} />
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.heroTitle}>Duel vs {opponentName(game)}</Text>
          <Text style={styles.heroSub}>{game.set_size} clues · 30s each · same set for both of you. Answers are auto-graded and final.</Text>
          <PrimaryAction title="Start your run" subtitle="Timer starts on each clue" icon="bolt" onPress={() => { tapMedium(); setPlaying(true); }} />
        </Card>
      </Screen>
    );
  }

  /* ---- Recap / waiting ---- */
  const iAmCreator = me === game.creator_id;
  const myScore = finished ? (iAmCreator ? game.creator_score : game.opponent_score) : sumPoints(game.my_attempts);
  const theirScore = finished ? (iAmCreator ? game.opponent_score : game.creator_score) : null;
  const myCorrect = countCorrect(game.my_attempts ?? []);
  const theirCorrect = countCorrect(game.opponent_attempts ?? []);
  const verdict: Verdict = finished ? (game.winner_id == null ? 'draw' : game.winner_id === me ? 'win' : 'loss') : 'waiting';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.banner, bannerTone(verdict)]}>
        <Text style={styles.crown}>{verdict === 'win' ? '👑' : verdict === 'draw' ? '🤝' : verdict === 'loss' ? '🙃' : '⏳'}</Text>
        <Text style={[styles.verdict, verdictInk(verdict)]}>
          {verdict === 'win' ? 'VICTORY' : verdict === 'loss' ? 'DEFEAT' : verdict === 'draw' ? 'DRAW' : 'YOUR RUN IS IN'}
        </Text>
        <View style={styles.vs}>
          <View style={styles.pl}>
            <View style={[styles.ava, { backgroundColor: colors.gold }]}><Text style={styles.avaInk}>You</Text></View>
            <Text style={styles.plNm}>You</Text>
            <Text style={[styles.plSc, verdict === 'win' && { color: colors.gold }]}>{myScore.toLocaleString()}</Text>
          </View>
          <Text style={styles.dash}>–</Text>
          <View style={styles.pl}>
            <View style={[styles.ava, { backgroundColor: colors.muted }]}><Text style={styles.avaInk}>{initial(opponentName(game))}</Text></View>
            <Text style={styles.plNm}>{opponentName(game)}</Text>
            <Text style={styles.plSc}>{theirScore == null ? '···' : theirScore.toLocaleString()}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {verdict === 'waiting'
            ? `${opponentName(game)} has answered ${game.opponent_answered} of ${game.set_size}. Result reveals once they finish.`
            : `You ${myCorrect} of ${game.set_size} · ${opponentName(game)} ${theirCorrect} of ${game.set_size}`}
        </Text>
      </View>

      {verdict === 'waiting' ? (
        <Text style={styles.note}>Their per-clue answers stay hidden until the duel finalizes — you only see how many they've done.</Text>
      ) : null}

      <Text style={styles.sec}>Clue by clue</Text>
      {game.questions.map((q) => {
        const mine = (game.my_attempts ?? []).find((a) => a.question_id === q.id);
        const theirs = (game.opponent_attempts ?? []).find((a) => a.question_id === q.id);
        const accent = accentFor(q.category_id);
        return (
          <View key={q.id} style={styles.clue}>
            <View style={[styles.rail, { backgroundColor: accent }]} />
            <View style={styles.diff}><DifficultyPips rank={q.difficulty_rank} tone={accent} /></View>
            <View style={styles.ci}>
              <Text style={styles.ans} numberOfLines={1}>{q.answer}</Text>
              <Text style={[styles.cat, { color: accent }]} numberOfLines={1}>{q.category_name}{q.subcategory_name ? ` · ${q.subcategory_name}` : ''}</Text>
            </View>
            <View style={styles.marks}>
              <Mark grade={mine?.grade} />
              <Mark grade={finished ? theirs?.grade : undefined} pending={!finished} />
            </View>
          </View>
        );
      })}

      <View style={styles.foot}>
        {finished && game.opponent?.id ? (
          <Pressable style={({ pressed }) => [styles.btn, styles.btnGold, pressed && styles.pressed]} onPress={() => rematch(game)}>
            <Text style={styles.btnGoldText}>Rematch {opponentName(game)}</Text>
          </Pressable>
        ) : null}
        <Pressable style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]} onPress={() => router.back()}>
          <Text style={styles.btnGhostText}>Back to Compete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

async function rematch(game: GamePayload) {
  try {
    if (!game.opponent?.id) return;
    tapMedium();
    const newId = await createGame({ opponentId: game.opponent.id, count: game.set_size });
    router.replace(`/duel/${newId}` as any);
  } catch (e) {
    Alert.alert('Could not start rematch', e instanceof Error ? e.message : 'Try again.');
  }
}

function Mark({ grade, pending }: { grade?: AttemptGrade; pending?: boolean }) {
  if (pending) return <View style={[styles.mk, styles.mkSkip]}><Text style={styles.mkSkipText}>·</Text></View>;
  const ok = grade === 'correct';
  const answered = grade != null;
  return (
    <View style={[styles.mk, ok ? styles.mkOk : answered ? styles.mkNo : styles.mkSkip]}>
      <Text style={ok ? styles.mkOkText : answered ? styles.mkNoText : styles.mkSkipText}>{ok ? '✓' : answered ? '✕' : '·'}</Text>
    </View>
  );
}

function opponentName(g: GamePayload) { return g.opponent?.display_name ?? g.opponent?.username ?? 'Opponent'; }
function initial(name: string) { return name.trim().charAt(0).toUpperCase() || '?'; }
function sumPoints(a: DailyAttempt[]) { return a.reduce((s, x) => s + (x.points ?? 0), 0); }
function countCorrect(a: DailyAttempt[]) { return a.filter((x) => x.grade === 'correct').length; }
function bannerTone(v: Verdict) { return v === 'win' ? styles.bWin : v === 'loss' ? styles.bLoss : styles.bDraw; }
function verdictInk(v: Verdict) {
  return v === 'win' ? { color: colors.gold } : v === 'loss' ? { color: colors.red } : v === 'draw' ? { color: colors.teal } : { color: colors.muted };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.sm },
  heroTitle: { ...type.title, color: colors.ink },
  heroSub: { ...type.body, color: colors.muted },

  banner: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, alignItems: 'center', gap: 6 },
  bWin: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  bLoss: { borderColor: colors.red, backgroundColor: colors.redSoft },
  bDraw: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  crown: { fontSize: 30 },
  verdict: { ...type.overline, letterSpacing: 2, fontWeight: '800' },
  vs: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 8 },
  pl: { alignItems: 'center', gap: 6, width: 120 },
  ava: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  avaInk: { ...type.label, color: colors.background, fontWeight: '800' },
  plNm: { ...type.caption, color: colors.muted, fontWeight: '700' },
  plSc: { fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.ink },
  dash: { fontSize: 22, color: colors.dim, fontWeight: '800', marginTop: 16 },
  meta: { ...type.caption, color: colors.muted, textAlign: 'center', marginTop: 4 },
  note: { ...type.caption, color: colors.muted, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },

  sec: { ...type.overline, color: colors.muted, marginTop: spacing.sm, marginLeft: 4 },
  clue: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11, paddingRight: 12, paddingLeft: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  diff: { width: 62, flex: 0 },
  ci: { flex: 1, minWidth: 0 },
  ans: { ...type.bodyStrong, color: colors.ink },
  cat: { ...type.caption, marginTop: 2, fontWeight: '600' },
  marks: { flexDirection: 'row', gap: 7 },
  mk: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mkOk: { backgroundColor: colors.greenSoft },
  mkOkText: { color: colors.green, fontWeight: '800' },
  mkNo: { backgroundColor: colors.redSoft },
  mkNoText: { color: colors.red, fontWeight: '800' },
  mkSkip: { backgroundColor: colors.surfaceAlt },
  mkSkipText: { color: colors.dim, fontWeight: '800' },

  foot: { gap: 9, marginTop: spacing.md },
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnGold: { backgroundColor: colors.gold },
  btnGoldText: { ...type.bodyStrong, color: colors.background },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  btnGhostText: { ...type.bodyStrong, color: colors.ink },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
