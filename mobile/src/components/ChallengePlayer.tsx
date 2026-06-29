import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClueCard } from '@/src/components/ui';
import { QuestionTimer } from '@/src/components/QuestionTimer';
import { displayClue } from '@/src/clues/jeopardyStyle';
import { tapLight, notifyError, notifySuccess, notifyWarning } from '@/src/lib/haptics';
import { gradeResponse, type GradeResult } from '@/src/scoring/answerGrader';
import { colors, radius, spacing, type } from '@/src/theme';
import type { AttemptGrade, ChallengeQuestion } from '@/src/types/supabase';

/**
 * Shared timed answer-flow for Compete modes (Daily Challenge + Duels). Mirrors the
 * Train grade-then-confirm pattern, but adds a per-clue countdown (QuestionTimer) that
 * auto-reveals a no-answer at zero. The run is buffered locally and handed to onComplete
 * as one batch when it finishes — nothing is written mid-run, so abandoning records
 * nothing. This component owns the UI, grading, timing, and advance.
 */
export type ChallengePlayerAttempt = {
  question: ChallengeQuestion;
  response: string | null;
  grade: AttemptGrade;
  timeMs: number;
};
export type ChallengePlayerProps = {
  questions: ChallengeQuestion[];
  startIndex?: number;
  secondsPerQuestion?: number;
  // Daily/practice let the player correct the auto-grade. Duels set this false: the
  // auto-grade is final and the override chips are hidden (no marking yourself right).
  allowGradeOverride?: boolean;
  // Called once, with every buffered attempt, when the last clue is answered. May throw
  // to keep the player on the Finish screen for a retry.
  onComplete: (attempts: ChallengePlayerAttempt[], summary: { correct: number; total: number }) => Promise<void> | void;
};

export function ChallengePlayer({ questions, startIndex = 0, secondsPerQuestion = 30, allowGradeOverride = true, onComplete }: ChallengePlayerProps) {
  const [index, setIndex] = useState(startIndex);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [override, setOverride] = useState<AttemptGrade | null>(null);
  const [saving, setSaving] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const buffer = useRef<ChallengePlayerAttempt[]>([]);
  const startedAt = useRef(Date.now());

  const q = questions[index] ?? null;
  const finalGrade: AttemptGrade = override ?? result?.grade ?? 'unknown';
  const elapsedMs = useMemo(() => () => Math.min(secondsPerQuestion * 1000, Date.now() - startedAt.current), [secondsPerQuestion]);

  function reveal(auto: boolean) {
    if (!q || result) return;
    const r: GradeResult = auto && !typed.trim()
      ? { grade: 'unknown', label: 'No answer', detail: `Time! The answer was ${q.answer}.` }
      : gradeResponse(q as any, typed);
    if (r.grade === 'correct') notifySuccess();
    else if (r.grade === 'close') notifyWarning();
    else notifyError();
    setOverride(r.grade);
    setResult(r);
  }

  async function saveAndAdvance() {
    if (!q || !result || saving) return;

    const all = [...buffer.current, { question: q, response: typed.trim() || null, grade: finalGrade, timeMs: elapsedMs() }];
    buffer.current = all;
    const nowCorrect = correctCount + (finalGrade === 'correct' ? 1 : 0);
    if (finalGrade === 'correct') setCorrectCount(nowCorrect);
    tapLight();

    const next = index + 1;
    if (next >= questions.length) {
      // Commit the whole run now (one batch call). If it throws, stay on Finish to retry.
      try {
        setSaving(true);
        await onComplete(all, { correct: nowCorrect, total: questions.length });
      } finally {
        setSaving(false);
      }
      return;
    }
    setIndex(next);
    setTyped('');
    setResult(null);
    setOverride(null);
    startedAt.current = Date.now();
  }

  if (!q) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>Clue {index + 1} of {questions.length}</Text>
          </View>
          {/* Timer pauses (running=false) once an answer is revealed. questionKey resets it per clue. */}
          <QuestionTimer seconds={secondsPerQuestion} running={!result} questionKey={q.id} onExpire={() => reveal(true)} />

          <ClueCard
            categoryId={q.category_id}
            categoryName={q.category_name}
            subcategoryName={q.subcategory_name}
            rank={q.difficulty_rank}
            clue={displayClue(q as any)}
            imageUrl={q.image_url}
          />
          {q.constraint_text ? <Text style={styles.constraint}>{q.constraint_text}</Text> : null}

          <View style={styles.answerBlock}>
            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              editable={!result}
              placeholder="What is…"
              placeholderTextColor={colors.dim}
              autoCapitalize="words"
              returnKeyType="send"
              onSubmitEditing={() => reveal(false)}
            />
            {!result ? (
              <Pressable
                style={({ pressed }) => [styles.submit, !typed.trim() && styles.disabled, pressed && styles.pressed]}
                onPress={() => reveal(false)}
                disabled={!typed.trim()}
              >
                <Text style={styles.submitText}>Submit</Text>
              </Pressable>
            ) : null}
          </View>

          {result ? (
            <View style={styles.resultBlock}>
              <View style={[styles.resultCard, tone(finalGrade)]}>
                <Text style={[styles.resultTitle, ink(finalGrade)]}>{label(finalGrade)}</Text>
                <Text style={styles.resultDetail}>{result.detail}</Text>
              </View>
              {allowGradeOverride ? (
                <>
                  <Text style={styles.hint}>Auto-graded — tap to adjust</Text>
                  <View style={styles.chips}>
                    {(['correct', 'missed'] as const).map((g) => {
                      const active = finalGrade === g;
                      return (
                        <Pressable key={g} onPress={() => { tapLight(); setOverride(g); }} style={({ pressed }) => [styles.chip, active && tone(g), pressed && styles.pressed]}>
                          <Text style={[styles.chipText, active && ink(g)]}>{label(g)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={styles.hint}>Auto-graded · final in duels</Text>
              )}
              <Pressable style={({ pressed }) => [styles.next, saving && styles.disabled, pressed && styles.pressed]} onPress={saveAndAdvance} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.nextText}>{index + 1 >= questions.length ? 'Finish' : 'Next clue'}</Text>}
              </Pressable>
            </View>
          ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function tone(g: string) { return g === 'correct' ? styles.correct : g === 'close' ? styles.close : styles.missed; }
function ink(g: string) { return g === 'correct' ? { color: colors.green } : g === 'close' ? { color: colors.gold } : { color: colors.red }; }
function label(g: AttemptGrade) { return g === 'correct' ? 'Correct' : g === 'close' ? 'Close' : g === 'unknown' ? 'No answer' : 'Missed'; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 96, gap: spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { ...type.heading, color: colors.ink },
  constraint: { ...type.label, color: colors.gold, textAlign: 'center' },
  answerBlock: { gap: spacing.sm },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.md, ...type.bodyStrong },
  submit: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  submitText: { ...type.bodyStrong, color: colors.background },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  resultBlock: { gap: spacing.sm },
  hint: { ...type.caption, color: colors.dim, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chipText: { ...type.label, color: colors.muted },
  resultCard: { gap: 4, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  correct: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  close: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  missed: { borderColor: colors.red, backgroundColor: colors.redSoft },
  resultTitle: { ...type.heading },
  resultDetail: { ...type.body, color: colors.ink },
  next: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  nextText: { ...type.bodyStrong, color: colors.background },
});
