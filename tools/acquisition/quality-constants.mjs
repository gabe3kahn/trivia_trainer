/**
 * Shared quality-gate constants and the single decision function.
 *
 * The decision ladder used to be copy-pasted in both question-quality-rules.mjs
 * (base audit) and intake-assessment.mjs (merge). That meant a threshold change
 * in one place silently diverged from the other. Both now route through
 * `decideFromScore` so the base and merged decisions can never disagree.
 */

export const QUALITY_THRESHOLDS = {
  deactivate: 45, // below this: inactive, do not import into practice
  replace: 70, // below this: inactive, slated for replacement
  rewrite: 88, // below this: active, but flagged for an editorial rewrite
};

/** Feedback severity at/above this bumps an otherwise-clean "keep" to "rewrite". */
export const FEEDBACK_REWRITE_SEVERITY = 12;

export function decideFromScore(score) {
  if (score < QUALITY_THRESHOLDS.deactivate) return 'deactivate';
  if (score < QUALITY_THRESHOLDS.replace) return 'replace';
  if (score < QUALITY_THRESHOLDS.rewrite) return 'rewrite';
  return 'keep';
}
