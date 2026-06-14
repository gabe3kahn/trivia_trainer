import { auditFeedbackIssues } from './feedback-quality-rules.mjs';
import { auditQuestion, isActiveQualityDecision, prepareQuestionForIntake } from './question-quality-rules.mjs';
import { chooseCalibratedValue, evaluateDifficulty, valueToRank } from './difficulty-rules.mjs';
import { decideFromScore, FEEDBACK_REWRITE_SEVERITY } from './quality-constants.mjs';

export function assessQuestionForIntake(question) {
  // 1. Normalize / apply editorial one-offs.
  const preparedBase = prepareQuestionForIntake(question);

  // 2-3. Base clue quality, then feedback-shaped checks, merged into one decision.
  const baseQuality = auditQuestion(preparedBase);
  const feedback = auditFeedbackIssues(preparedBase);
  const quality = mergeQuality(baseQuality, feedback);

  // 4. Reassess difficulty and calibrate the dollar value.
  const difficulty = evaluateDifficulty(preparedBase);
  const calibratedValue = chooseCalibratedValue(preparedBase, difficulty);
  const prepared = {
    ...preparedBase,
    value: calibratedValue,
    difficulty_rank: valueToRank(calibratedValue),
  };

  // 5. Decide whether the row can enter training.
  return {
    prepared,
    quality,
    feedback,
    difficulty: {
      ...difficulty,
      applied_value: calibratedValue,
      applied_rank: valueToRank(calibratedValue),
    },
    active: isActiveQualityDecision(quality.decision),
  };
}

function mergeQuality(quality, feedback) {
  const score = Math.max(0, quality.score - feedback.severity);
  let decision = decideFromScore(score);
  // Strong feedback alone can demote an otherwise-clean "keep" to "rewrite".
  if (feedback.severity >= FEEDBACK_REWRITE_SEVERITY && decision === 'keep') decision = 'rewrite';

  return {
    score,
    decision,
    issues: [...quality.issues, ...feedback.issues.map((issue) => `feedback:${issue}`)],
    warnings: quality.warnings ?? [],
  };
}
