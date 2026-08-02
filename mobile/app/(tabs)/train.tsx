import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ClueCard, Header, ModeCard, Pill, PrimaryAction, Screen, Section } from '@/src/components/ui';
import { displayClue } from '@/src/clues/jeopardyStyle';
import { tapLight, tapMedium, notifyError, notifySuccess, notifyWarning } from '@/src/lib/haptics';
import { badgeIcon } from '@/src/constants/badges';
import { useBadgeCheck } from '@/src/contexts/BadgeUnlockContext';
import { gradeResponse, type GradeResult } from '@/src/scoring/answerGrader';
import {
  fetchBadges,
  fetchEarnedBadges,
  fetchHomeCompetencies,
  getRecommendedQuestions,
  recordServedQuestions,
  submitPracticeRun,
} from '@/src/services/triviaApi';
import { accentFor, colors, radius, spacing, type } from '@/src/theme';
import type { AttemptGrade, RecommendedQuestion, SessionMode } from '@/src/types/supabase';

const sessionLength = 12;

type SessionAttemptSummary = {
  questionId: string;
  categoryName: string;
  value: number;
  difficultyRank: number;
  grade: GradeResult['grade'];
};

type StartOptions = { mechanics?: string[]; categories?: string[]; values?: number[]; limit?: number };

// A run is buffered locally and only committed when it reaches the end. An
// abandoned run writes nothing, and competency/badges recalc once, at the end.
type PendingAttempt = {
  questionId: string;
  typedResponse: string | null;
  grade: AttemptGrade;
  timeToAnswerMs: number | null;
};
type RunConfig = {
  mode: SessionMode;
  questionIds: string[];
  selectedCategories: string[];
  selectedValues: number[];
  selectedMechanics: string[];
};

// Post-run "Competency this run" recap: a before→after diff over the categories answered.
type CatDelta = {
  id: string;
  name: string;
  before: number;
  after: number;
  delta: number;
  tierUp: string | null;
  tierUpIcon: string | null;
};
type CompetencyRecap = {
  overallBefore: number;
  overallAfter: number;
  cats: CatDelta[];
  newBadges: { key: string; name: string; description: string }[];
};
type RunStart = { comps: Map<string, { score: number; tier: string }>; overall: number; badgeKeys: Set<string> };

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const deltaText = (d: number) => (d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${Math.abs(d)}` : '—');
const deltaStyle = (d: number) =>
  ({ color: d > 0 ? colors.green : d < 0 ? colors.red : colors.dim, fontWeight: '800' as const });

/** Reduce category_competencies rows to a score/tier map + the overall score. */
function indexComps(rows: unknown): { map: Map<string, { score: number; tier: string }>; overall: number } {
  const map = new Map<string, { score: number; tier: string }>();
  let overall = 0;
  for (const c of (rows ?? []) as { dimension_type: string; dimension_key: string; score: number; tier: string }[]) {
    if (c.dimension_type === 'category') map.set(c.dimension_key, { score: c.score, tier: c.tier });
    else if (c.dimension_type === 'overall') overall = c.score;
  }
  return { map, overall };
}

export default function TrainScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    start?: string;
    category?: string;
    categoryName?: string;
    categories?: string;
    values?: string;
    limit?: string;
  }>();
  const [questions, setQuestions] = useState<RecommendedQuestion[]>([]);
  const [pendingAttempts, setPendingAttempts] = useState<PendingAttempt[]>([]);
  const [runConfig, setRunConfig] = useState<RunConfig | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [typedResponse, setTypedResponse] = useState('');
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [attemptSummaries, setAttemptSummaries] = useState<SessionAttemptSummary[]>([]);
  const [loadingMode, setLoadingMode] = useState<SessionMode | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [overrideGrade, setOverrideGrade] = useState<AttemptGrade | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [runStart, setRunStart] = useState<RunStart | null>(null);
  const [runRecap, setRunRecap] = useState<CompetencyRecap | null>(null);
  const handledParamRef = useRef<string | null>(null);
  const flushedRef = useRef(false); // guards the one-time end-of-run commit

  const checkBadges = useBadgeCheck();
  const activeQuestion = questions[activeIndex] ?? null;
  const completed = questions.length > 0 && activeIndex >= questions.length;

  // Practice runs inside this tab (no route change), so the global navigation-based
  // badge check never fires — re-check when a session finishes.
  useEffect(() => {
    if (!completed || flushedRef.current) return;
    flushedRef.current = true;
    void (async () => {
      // 1) Commit the whole run in one batch call. Nothing is written mid-run, so
      //    abandoning records nothing; competency + badges recalc once, server-side.
      try {
        if (runConfig && pendingAttempts.length) {
          await submitPracticeRun({
            mode: runConfig.mode,
            questionIds: runConfig.questionIds,
            attempts: pendingAttempts.map((a) => ({
              questionId: a.questionId,
              response: a.typedResponse,
              grade: a.grade,
              timeMs: a.timeToAnswerMs,
            })),
            selectedCategories: runConfig.selectedCategories,
            selectedValues: runConfig.selectedValues,
            selectedMechanics: runConfig.selectedMechanics,
          });
        }
      } catch (error) {
        Alert.alert(
          'Could not save run',
          error instanceof Error ? error.message : 'Your answers may not have been recorded.',
        );
      }

      // 2) Badges/competency now reflect the full run — surface them.
      void checkBadges();
      if (!runStart) return;
      try {
        const [comps, earned, allBadges] = await Promise.all([
          fetchHomeCompetencies(),
          fetchEarnedBadges(),
          fetchBadges(),
        ]);
        const { map: afterMap, overall: overallAfter } = indexComps(comps);

        // Badges earned during this run, mapped to the category they reward (for the tier-up icon).
        const freshKeys = ((earned ?? []) as { badge_key: string }[])
          .map((e) => e.badge_key)
          .filter((k) => !runStart.badgeKeys.has(k));
        const byKey = new Map(
          ((allBadges ?? []) as { key: string; name: string; description: string; criteria: { dimension?: string } }[]).map(
            (b) => [b.key, b],
          ),
        );
        const newBadges = freshKeys.map((k) => byKey.get(k)).filter(Boolean) as {
          key: string;
          name: string;
          description: string;
          criteria: { dimension?: string };
        }[];
        const badgeByDim = new Map(newBadges.filter((b) => b.criteria?.dimension).map((b) => [b.criteria.dimension!, b]));

        // One row per category answered this run (merged id + name from the served questions).
        const touched = new Map<string, string>();
        for (const q of questions) touched.set(q.category_id, q.category_name);
        const cats: CatDelta[] = [...touched.entries()].map(([id, name]) => {
          const before = runStart.comps.get(id)?.score ?? 0;
          const after = afterMap.get(id)?.score ?? 0;
          const tierBefore = runStart.comps.get(id)?.tier;
          const tierAfter = afterMap.get(id)?.tier;
          const tierUp = tierAfter && tierAfter !== tierBefore && after > before ? capitalize(tierAfter) : null;
          const badge = badgeByDim.get(id);
          return { id, name, before, after, delta: after - before, tierUp, tierUpIcon: tierUp && badge ? badgeIcon(badge.key) : null };
        });
        cats.sort((a, b) => b.delta - a.delta); // signed, largest gain first → biggest drop last

        setRunRecap({
          overallBefore: runStart.overall,
          overallAfter,
          cats,
          newBadges: newBadges.map((b) => ({ key: b.key, name: b.name, description: b.description })),
        });
      } catch {
        // best-effort — a recap failure must not disrupt the done screen
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);
  // The grade we'll actually record: the user's override if they tapped one,
  // otherwise the auto-grader's suggestion.
  const finalGrade: AttemptGrade = overrideGrade ?? gradeResult?.grade ?? 'unknown';

  // Auto-start a session when launched from Home (weakness CTA or a category tap).
  useEffect(() => {
    if (!params.start) return;
    const token = `${params.start}:${params.category ?? ''}:${params.categories ?? ''}:${params.values ?? ''}:${params.limit ?? ''}`;
    if (handledParamRef.current === token) return;
    handledParamRef.current = token;

    if (params.start === 'weakness') {
      void startSession('weakness');
    } else if (params.start === 'selected' && params.category) {
      void startSession('selected', { categories: [params.category] });
    } else if (params.start === 'custom') {
      const categories = params.categories ? params.categories.split(',').filter(Boolean) : undefined;
      const values = params.values
        ? params.values.split(',').map(Number).filter((n) => !Number.isNaN(n))
        : undefined;
      const limit = params.limit ? Number(params.limit) : undefined;
      void startSession('selected', { categories, values, limit });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.start, params.category, params.categories, params.values, params.limit]);

  async function startSession(mode: SessionMode, options?: StartOptions) {
    try {
      setLoadingMode(mode);
      tapMedium();
      const nextQuestions = await getRecommendedQuestions({
        mode,
        limit: options?.limit ?? sessionLength,
        categories: options?.categories ?? null,
        values: options?.values ?? null,
        mechanics: options?.mechanics ?? null,
      });

      if (!nextQuestions.length) {
        Alert.alert('No questions yet', 'The question bank does not have matching clues for this mode.');
        return;
      }

      // Mark these questions served NOW (run start), so the adaptive selector can
      // apply anti-repeat + the wordplay cooldown even if the run is abandoned.
      // Best-effort — never blocks the session.
      void recordServedQuestions(nextQuestions.map((question) => question.id));

      // Don't create the session or write anything yet — buffer the run and commit it
      // only if it reaches the end (see the completion effect). Abandoning records nothing.
      setRunConfig({
        mode,
        questionIds: nextQuestions.map((question) => question.id),
        selectedCategories: options?.categories ?? [],
        selectedValues: options?.values ?? [],
        selectedMechanics: options?.mechanics ?? [],
      });

      setQuestions(nextQuestions);
      setPendingAttempts([]);
      flushedRef.current = false;
      setActiveIndex(0);
      setTypedResponse('');
      setGradeResult(null);
      setAttemptSummaries([]);
      setStartedAt(Date.now());
      setRunRecap(null);

      // Snapshot competency + earned badges BEFORE the run, so the recap can diff after.
      try {
        const [comps, earned] = await Promise.all([fetchHomeCompetencies(), fetchEarnedBadges()]);
        const { map, overall } = indexComps(comps);
        setRunStart({
          comps: map,
          overall,
          badgeKeys: new Set(((earned ?? []) as { badge_key: string }[]).map((e) => e.badge_key)),
        });
      } catch {
        setRunStart(null); // recap is best-effort; never block a session
      }
    } catch (error) {
      Alert.alert('Could not start session', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoadingMode(null);
    }
  }

  // Reveal the auto-grade as a *suggestion*. Nothing is written yet — the user
  // can override the grade before we commit it on advance.
  function submitAnswer() {
    if (!activeQuestion || gradeResult) return;

    const result = gradeResponse(activeQuestion, typedResponse);
    setElapsedMs(startedAt ? Date.now() - startedAt : null);

    if (result.grade === 'correct') notifySuccess();
    else if (result.grade === 'close') notifyWarning();
    else notifyError();

    setOverrideGrade(result.grade);
    setGradeResult(result);
  }

  // Buffer the final (possibly user-corrected) grade locally, then advance. Nothing is
  // written to the server until the run completes — see the completion effect.
  function saveAndAdvance() {
    if (!activeQuestion || !gradeResult) return;

    setPendingAttempts((current) => [
      ...current,
      {
        questionId: activeQuestion.id,
        typedResponse: typedResponse.trim() || null,
        grade: finalGrade,
        timeToAnswerMs: elapsedMs,
      },
    ]);

    setAttemptSummaries((current) => [
      ...current,
      {
        questionId: activeQuestion.id,
        categoryName: activeQuestion.category_name,
        value: activeQuestion.value,
        difficultyRank: activeQuestion.difficulty_rank,
        grade: finalGrade,
      },
    ]);

    tapLight();
    setActiveIndex((current) => current + 1);
    setTypedResponse('');
    setGradeResult(null);
    setOverrideGrade(null);
    setElapsedMs(null);
    setStartedAt(Date.now());
  }

  // Clear all session state, returning to the mode-pick home. Shared by the quit
  // flow (mid-session) and the "Back to Train" control on the completed screen.
  function resetSession() {
    setQuestions([]);
    setPendingAttempts([]);
    setRunConfig(null);
    flushedRef.current = false;
    setActiveIndex(0);
    setTypedResponse('');
    setGradeResult(null);
    setOverrideGrade(null);
    setElapsedMs(null);
    setAttemptSummaries([]);
    setStartedAt(null);
    handledParamRef.current = null;
    // `completed` is derived from questions/activeIndex (see above), so clearing
    // those returns us to mode-pick — no separate flag to reset.
  }

  // Bail out of an in-progress session. The run is only committed when it reaches the
  // end, so quitting partway through records nothing — no attempts, no competency change.
  function endSession() {
    Alert.alert('Quit this session?', 'This run won’t be recorded. You can start a new set anytime.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'Quit',
        style: 'destructive',
        onPress: () => {
          tapLight();
          resetSession();
        },
      },
    ]);
  }

  // From the completed screen: the run is already recorded, so go straight back
  // to mode-pick with no "won't be recorded" warning.
  function backToTrain() {
    tapLight();
    resetSession();
  }

  const sessionSummary = summarizeAttempts(attemptSummaries);
  const progress = questions.length ? (activeIndex / questions.length) * 100 : 0;

  /* ---------------------------- In session ---------------------------- */
  if (activeQuestion) {
    return (
      <SafeAreaView style={styles.activeContainer} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.activeContent}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Clue {activeIndex + 1} of {questions.length}
          </Text>
          <Pressable onPress={endSession} hitSlop={12}>
            <Text style={styles.quitText}>Quit</Text>
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <ClueCard
          categoryId={activeQuestion.category_id}
          categoryName={activeQuestion.category_name}
          subcategoryName={activeQuestion.subcategory_name ?? formatMechanic(activeQuestion.mechanic)}
          mechanic={activeQuestion.mechanic}
          rank={activeQuestion.difficulty_rank}
          clue={displayClue(activeQuestion)}
          imageUrl={activeQuestion.image_url}
        />
        {activeQuestion.constraint_text ? <Text style={styles.constraintText}>{activeQuestion.constraint_text}</Text> : null}

        <View style={styles.answerBlock}>
          <TextInput
            style={styles.answerInput}
            value={typedResponse}
            onChangeText={setTypedResponse}
            editable={!gradeResult}
            placeholder="What is…"
            placeholderTextColor={colors.dim}
            autoCapitalize="words"
            returnKeyType="send"
            onSubmitEditing={submitAnswer}
          />
          {!gradeResult ? (
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                !typedResponse.trim() && styles.disabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={submitAnswer}
              disabled={!typedResponse.trim()}
            >
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          ) : null}
        </View>

        {gradeResult ? (
          <View style={styles.resultBlock}>
            <Card style={[styles.resultCard, resultTone(finalGrade)]}>
              <Text style={[styles.resultTitle, resultInk(finalGrade)]}>{labelForGrade(finalGrade)}</Text>
              <Text style={styles.resultDetail}>{gradeResult.detail}</Text>
            </Card>

            <Text style={styles.selfGradeHint}>Auto-graded — tap to adjust</Text>
            <View style={styles.gradeChips}>
              {(['correct', 'missed'] as const).map((grade) => {
                const active = finalGrade === grade;
                return (
                  <Pressable
                    key={grade}
                    onPress={() => {
                      tapLight();
                      setOverrideGrade(grade);
                    }}
                    style={({ pressed }) => [
                      styles.gradeChip,
                      active && resultTone(grade),
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.gradeChipText, active && resultInk(grade)]}>{labelForGrade(grade)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [styles.nextButton, pressed && styles.buttonPressed]}
              onPress={saveAndAdvance}
            >
              <Text style={styles.nextText}>{activeIndex + 1 >= questions.length ? 'See results' : 'Next clue'}</Text>
            </Pressable>
          </View>
        ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---------------------------- Completed ----------------------------- */
  if (completed) {
    return (
      <Screen>
        <Pressable onPress={backToTrain} hitSlop={12} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹ Train</Text>
        </Pressable>
        <Header kicker="Train" title="Session done" right={<Pill tone="teal">{questions.length} clues</Pill>} />
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHero}>
            <Text style={styles.summaryScore}>{sessionSummary.scoreText}</Text>
            <Text style={styles.summaryLabel}>correct</Text>
          </View>
          <View style={styles.summaryStats}>
            <SummaryStat label="Correct" value={String(sessionSummary.correct)} />
            <SummaryStat label="Missed" value={String(sessionSummary.missed)} />
            <SummaryStat label="Points" value={String(sessionSummary.points)} />
          </View>
        </Card>

        <Card>
          <Text style={styles.doneTitle}>{sessionSummary.title}</Text>
          <Text style={styles.doneText}>{sessionSummary.detail}</Text>
        </Card>

        {runRecap && runRecap.cats.length > 0 ? (
          <Card>
            <View style={styles.recapHead}>
              <Text style={styles.recapOver}>Competency this run</Text>
              <View style={styles.recapOverall}>
                <Text style={styles.recapBefore}>{runRecap.overallBefore}</Text>
                <Text style={styles.recapArrow}>→</Text>
                <Text style={styles.recapNow}>{runRecap.overallAfter}</Text>
                <Text style={[styles.recapDelta, deltaStyle(runRecap.overallAfter - runRecap.overallBefore)]}>
                  {deltaText(runRecap.overallAfter - runRecap.overallBefore)}
                </Text>
              </View>
            </View>

            {runRecap.cats.map((c, i) => (
              <View key={c.id} style={[styles.recapRow, i === runRecap.cats.length - 1 && styles.recapRowLast]}>
                <View style={[styles.recapDot, { backgroundColor: accentFor(c.id) }]} />
                <Text style={styles.recapName} numberOfLines={1}>
                  {c.name}
                  {c.tierUp ? (
                    <Text style={styles.recapTierUp}>
                      {'  '}▲ {c.tierUp}
                      {c.tierUpIcon ? ` ${c.tierUpIcon}` : ''}
                    </Text>
                  ) : null}
                </Text>
                <Text style={styles.recapBA}>
                  {c.before} <Text style={styles.recapArrowSm}>→</Text> <Text style={styles.recapTo}>{c.after}</Text>
                </Text>
                <Text style={[styles.recapRowDelta, deltaStyle(c.delta)]}>{deltaText(c.delta)}</Text>
              </View>
            ))}

            {runRecap.newBadges.map((b) => (
              <View key={b.key} style={styles.recapBadge}>
                <View style={styles.recapBadgeIc}>
                  <Text style={styles.recapBadgeEmoji}>{badgeIcon(b.key)}</Text>
                </View>
                <View style={styles.recapBadgeText}>
                  <Text style={styles.recapBadgeTitle}>{b.name} unlocked</Text>
                  <Text style={styles.recapBadgeSub}>{b.description}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <PrimaryAction
          title="Run another set"
          subtitle="A fresh balanced mix tuned to your level"
          icon="refresh"
          loading={loadingMode === 'balanced'}
          onPress={() => startSession('balanced')}
        />
        <Pressable onPress={backToTrain} style={styles.backToTrainBtn}>
          <Text style={styles.backToTrainText}>Back to Train</Text>
        </Pressable>
      </Screen>
    );
  }

  /* ----------------------------- Mode pick ---------------------------- */
  return (
    <Screen>
      <Header kicker="Train" title="Pick a mode" right={<Pill tone="teal">{sessionLength} clues</Pill>} />

      <PrimaryAction
        title="Balanced session"
        subtitle="A smart mix across your strengths and weak spots, tuned to your level"
        loading={loadingMode === 'balanced'}
        disabled={Boolean(loadingMode)}
        onPress={() => startSession('balanced')}
      />

      <Section title="Other modes">
        <ModeCard
          icon="bullseye"
          title="Challenge my weaknesses"
          subtitle="Difficulty-weighted gaps, skewed just above your comfort zone."
          label={loadingMode === 'weakness' ? 'Loading' : 'Focus'}
          tone="teal"
          onPress={() => startSession('weakness')}
          disabled={Boolean(loadingMode)}
        />
        <ModeCard
          icon="random"
          title="Randomize"
          subtitle="Mixed categories, values, and mechanics."
          label={loadingMode === 'random' ? 'Loading' : 'Mix'}
          onPress={() => startSession('random')}
          disabled={Boolean(loadingMode)}
        />
        <ModeCard
          icon="history"
          title="Review misses"
          subtitle="Spaced queue from missed and skipped clues."
          label={loadingMode === 'review' ? 'Loading' : 'Review'}
          onPress={() => startSession('review')}
          disabled={Boolean(loadingMode)}
        />
        <ModeCard
          icon="puzzle-piece"
          title="Wordplay"
          subtitle="Before & After, starts-with, crossword, anagrams."
          label={loadingMode === 'wordplay' ? 'Loading' : 'Skill'}
          tone="purple"
          onPress={() => startSession('wordplay', { mechanics: ['crossword_clue', 'before_after', 'anagram', 'starts_with'] })}
          disabled={Boolean(loadingMode)}
        />
        <ModeCard
          icon="sliders"
          title="Custom run"
          subtitle="Choose your categories & difficulty."
          label="New"
          tone="gold"
          onPress={() => router.push('/custom-run' as never)}
          disabled={Boolean(loadingMode)}
        />
      </Section>

      <Text style={styles.hint}>Tip: tap any category on Home to drill it directly.</Text>
    </Screen>
  );
}

function formatMechanic(mechanic: string) {
  return mechanic
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resultTone(grade: string) {
  if (grade === 'correct') return styles.resultCorrect;
  if (grade === 'close') return styles.resultClose;
  return styles.resultMissed;
}

function resultInk(grade: string) {
  if (grade === 'correct') return { color: colors.green };
  if (grade === 'close') return { color: colors.gold };
  return { color: colors.red };
}

function labelForGrade(grade: AttemptGrade) {
  if (grade === 'correct') return 'Correct';
  if (grade === 'close') return 'Close';
  if (grade === 'unknown') return 'No answer';
  return 'Missed';
}

function summarizeAttempts(attempts: SessionAttemptSummary[]) {
  const correct = attempts.filter((attempt) => attempt.grade === 'correct').length;
  const missed = attempts.filter((attempt) => attempt.grade !== 'correct').length;
  // Score the new way: difficulty rank (1–5) per correct answer, matching daily/duel
  // (migrations 018/019/021) — not the old Jeopardy dollar value.
  const points = attempts.reduce((sum, attempt) => (attempt.grade === 'correct' ? sum + attempt.difficultyRank : sum), 0);
  const weakestCategory = mostMissedCategory(attempts);

  return {
    correct,
    missed,
    points,
    scoreText: `${correct}/${attempts.length || sessionLength}`,
    title: correct >= Math.ceil((attempts.length || sessionLength) * 0.7) ? 'Strong run.' : 'Good reps logged.',
    detail: weakestCategory
      ? `Review queue updated. Most misses: ${weakestCategory}.`
      : 'Review queue updated. Your next set will adapt from this session.',
  };
}

function mostMissedCategory(attempts: SessionAttemptSummary[]) {
  const misses = attempts.filter((attempt) => attempt.grade === 'missed' || attempt.grade === 'unknown');
  const counts = new Map<string, number>();

  for (const attempt of misses) {
    counts.set(attempt.categoryName, (counts.get(attempt.categoryName) ?? 0) + 1);
  }

  let topCategory: string | null = null;
  let topCount = 0;
  for (const [category, count] of counts) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }

  return topCategory;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  trainScreen: {
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  activeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  activeContent: {
    padding: spacing.md,
    paddingBottom: 96,
    gap: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressText: {
    ...type.heading,
    color: colors.ink,
  },
  quitText: {
    ...type.label,
    color: colors.dim,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },

  constraintText: {
    ...type.label,
    color: colors.gold,
    textAlign: 'center',
  },

  answerBlock: {
    gap: spacing.sm,
  },
  answerInput: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    ...type.bodyStrong,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    ...type.bodyStrong,
    color: colors.background,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  resultBlock: {
    gap: spacing.sm,
  },
  selfGradeHint: {
    ...type.caption,
    color: colors.dim,
    textAlign: 'center',
  },
  gradeChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gradeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeChipText: {
    ...type.label,
    color: colors.muted,
  },
  resultCard: {
    gap: 4,
  },
  resultCorrect: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  resultClose: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  resultMissed: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
  },
  resultTitle: {
    ...type.heading,
  },
  resultDetail: {
    ...type.body,
    color: colors.ink,
  },
  nextButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    ...type.bodyStrong,
    color: colors.background,
  },
  disabled: {
    opacity: 0.45,
  },

  doneTitle: {
    ...type.heading,
    color: colors.ink,
  },
  doneText: {
    ...type.body,
    color: colors.muted,
    marginTop: 4,
  },

  // "Competency this run" recap
  recapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  recapOver: { ...type.overline, color: colors.muted },
  recapOverall: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  recapBefore: { ...type.caption, color: colors.dim, fontWeight: '700' },
  recapArrow: { ...type.caption, color: colors.dim },
  recapArrowSm: { color: colors.dim },
  recapNow: { ...type.bodyStrong, color: colors.ink },
  recapDelta: { ...type.caption, fontWeight: '800', marginLeft: 2 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  recapRowLast: { borderBottomWidth: 0 },
  recapDot: { width: 10, height: 10, borderRadius: 3 },
  recapName: { ...type.body, fontWeight: '600', color: colors.ink, flex: 1 },
  recapTierUp: { color: colors.gold, fontWeight: '800', fontSize: 12 },
  recapBA: { ...type.caption, color: colors.muted, fontVariant: ['tabular-nums'] },
  recapTo: { color: colors.ink, fontWeight: '700' },
  recapRowDelta: { width: 46, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
  recapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(242,184,75,0.45)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  recapBadgeIc: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(242,184,75,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recapBadgeEmoji: { fontSize: 21 },
  recapBadgeText: { flex: 1 },
  recapBadgeTitle: { ...type.bodyStrong, color: colors.ink },
  recapBadgeSub: { ...type.caption, color: colors.gold, fontWeight: '700', marginTop: 1 },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  backLinkText: {
    ...type.label,
    color: colors.muted,
  },
  backToTrainBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backToTrainText: {
    ...type.bodyStrong,
    color: colors.muted,
  },
  summaryCard: {
    gap: spacing.md,
  },
  summaryHero: {
    alignItems: 'center',
    gap: 2,
  },
  summaryScore: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: colors.ink,
  },
  summaryLabel: {
    ...type.overline,
    color: colors.gold,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryStat: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  summaryStatValue: {
    ...type.title,
    color: colors.ink,
  },
  summaryStatLabel: {
    ...type.overline,
    color: colors.muted,
  },
  hint: {
    ...type.caption,
    color: colors.dim,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
