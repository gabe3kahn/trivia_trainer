import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Header, ModeCard, Pill, PrimaryAction, Screen, Section } from '@/src/components/ui';
import { displayClue } from '@/src/clues/jeopardyStyle';
import { tapLight, tapMedium, notifyError, notifySuccess, notifyWarning } from '@/src/lib/haptics';
import { gradeResponse, type GradeResult } from '@/src/scoring/answerGrader';
import { createPracticeSession, getRecommendedQuestions, submitPracticeAttempt } from '@/src/services/triviaApi';
import { colors, radius, spacing, type } from '@/src/theme';
import type { AttemptGrade, RecommendedQuestion, SessionMode } from '@/src/types/supabase';

const sessionLength = 12;

type SessionAttemptSummary = {
  questionId: string;
  categoryName: string;
  value: number;
  grade: GradeResult['grade'];
};

type StartOptions = { mechanics?: string[]; categories?: string[] };

export default function TrainScreen() {
  const params = useLocalSearchParams<{ start?: string; category?: string; categoryName?: string }>();
  const headerHeight = useHeaderHeight();
  const [questions, setQuestions] = useState<RecommendedQuestion[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [typedResponse, setTypedResponse] = useState('');
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [attemptSummaries, setAttemptSummaries] = useState<SessionAttemptSummary[]>([]);
  const [loadingMode, setLoadingMode] = useState<SessionMode | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [overrideGrade, setOverrideGrade] = useState<AttemptGrade | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const handledParamRef = useRef<string | null>(null);

  const activeQuestion = questions[activeIndex] ?? null;
  const completed = questions.length > 0 && activeIndex >= questions.length;
  // The grade we'll actually record: the user's override if they tapped one,
  // otherwise the auto-grader's suggestion.
  const finalGrade: AttemptGrade = overrideGrade ?? gradeResult?.grade ?? 'unknown';

  // Auto-start a session when launched from Home (weakness CTA or a category tap).
  useEffect(() => {
    if (!params.start) return;
    const token = `${params.start}:${params.category ?? ''}`;
    if (handledParamRef.current === token) return;
    handledParamRef.current = token;

    if (params.start === 'weakness') {
      void startSession('weakness');
    } else if (params.start === 'selected' && params.category) {
      void startSession('selected', { categories: [params.category] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.start, params.category]);

  async function startSession(mode: SessionMode, options?: StartOptions) {
    try {
      setLoadingMode(mode);
      tapMedium();
      const nextQuestions = await getRecommendedQuestions({
        mode,
        limit: sessionLength,
        categories: options?.categories ?? null,
        mechanics: options?.mechanics ?? null,
      });

      if (!nextQuestions.length) {
        Alert.alert('No questions yet', 'The question bank does not have matching clues for this mode.');
        return;
      }

      const nextSessionId = await createPracticeSession({
        mode,
        questionIds: nextQuestions.map((question) => question.id),
        selectedCategories: options?.categories ?? [],
        selectedMechanics: options?.mechanics ?? [],
      });

      setQuestions(nextQuestions);
      setSessionId(nextSessionId);
      setActiveIndex(0);
      setTypedResponse('');
      setGradeResult(null);
      setAttemptSummaries([]);
      setStartedAt(Date.now());
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

  // Commit the final (possibly user-corrected) grade, then advance.
  async function saveAndAdvance() {
    if (!activeQuestion || !gradeResult || saving) return;

    try {
      setSaving(true);
      await submitPracticeAttempt({
        sessionId,
        questionId: activeQuestion.id,
        typedResponse: typedResponse.trim() || null,
        grade: finalGrade,
        timeToAnswerMs: elapsedMs,
      });

      setAttemptSummaries((current) => [
        ...current,
        {
          questionId: activeQuestion.id,
          categoryName: activeQuestion.category_name,
          value: activeQuestion.value,
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
    } catch (error) {
      Alert.alert('Could not save attempt', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  const sessionSummary = summarizeAttempts(attemptSummaries);
  const progress = questions.length ? (activeIndex / questions.length) * 100 : 0;

  /* ---------------------------- In session ---------------------------- */
  if (activeQuestion) {
    return (
      <View style={styles.activeContainer}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={headerHeight}
        >
          <ScrollView
            contentContainerStyle={styles.activeContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Clue {activeIndex + 1} of {questions.length}
          </Text>
          <Pill tone="gold">{`$${activeQuestion.value}`}</Pill>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <Card style={styles.board}>
          <View style={styles.boardMetaRow}>
            <Text style={styles.boardCategory}>{activeQuestion.category_name}</Text>
            <Text style={styles.boardSub}>
              {activeQuestion.subcategory_name ?? formatMechanic(activeQuestion.mechanic)}
            </Text>
          </View>
          {activeQuestion.image_url ? (
            <Image
              source={{ uri: activeQuestion.image_url }}
              style={styles.clueImage}
              resizeMode="contain"
              accessible
              accessibilityLabel="Clue image"
            />
          ) : null}
          <Text style={styles.clueText}>{displayClue(activeQuestion)}</Text>
          {activeQuestion.constraint_text ? <Text style={styles.constraintText}>{activeQuestion.constraint_text}</Text> : null}
        </Card>

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
              style={({ pressed }) => [styles.nextButton, saving && styles.disabled, pressed && styles.buttonPressed]}
              onPress={saveAndAdvance}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.nextText}>{activeIndex + 1 >= questions.length ? 'See results' : 'Next clue'}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  /* ---------------------------- Completed ----------------------------- */
  if (completed) {
    return (
      <Screen>
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

        <PrimaryAction
          title="Run another set"
          subtitle="Pull a fresh difficulty-weighted mix"
          icon="refresh"
          loading={loadingMode === 'weakness'}
          onPress={() => startSession('weakness')}
        />
      </Screen>
    );
  }

  /* ----------------------------- Mode pick ---------------------------- */
  return (
    <Screen>
      <Header kicker="Train" title="Pick a mode" right={<Pill tone="teal">{sessionLength} clues</Pill>} />

      <PrimaryAction
        title="Challenge my weaknesses"
        subtitle="Difficulty-weighted gaps, skewed just above your comfort zone"
        loading={loadingMode === 'weakness'}
        disabled={Boolean(loadingMode)}
        onPress={() => startSession('weakness')}
      />

      <Section title="Other modes">
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
  const points = attempts.reduce((sum, attempt) => (attempt.grade === 'correct' ? sum + attempt.value : sum), 0);
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

  board: {
    minHeight: 150,
    gap: spacing.md,
    justifyContent: 'center',
    borderColor: colors.boardEdge,
    backgroundColor: colors.board,
    paddingVertical: spacing.lg,
  },
  boardMetaRow: {
    alignItems: 'center',
    gap: 4,
  },
  boardCategory: {
    ...type.overline,
    color: colors.boardInk,
    textAlign: 'center',
  },
  boardSub: {
    ...type.caption,
    color: colors.boardMeta,
    textAlign: 'center',
  },
  clueImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  clueText: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '700',
    color: colors.boardInk,
    textAlign: 'center',
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
