/**
 * Editorial one-off clue fixes.
 *
 * These are specific, hand-authored corrections for individual clues that the
 * generic rules can't (and shouldn't) infer. They previously lived inline in
 * `prepareQuestionForIntake`, where they ran as a hardcoded if/else chain on
 * every row of every import and were easy to lose track of. Keeping them here
 * as data makes the set auditable and keeps the rules engine generic.
 *
 * Each override is `{ id, test(row, next), apply(next) }`. `test` runs against
 * the normalized clue; `apply` mutates the working copy. First match wins.
 */

export const MANUAL_CLUE_OVERRIDES = [
  {
    id: 'richter-scale',
    test: (row) => row.answer === 'Richter scale',
    apply: (next) => {
      // Avoid leaking the answer words ("Richter"/"scale") into the clue.
      next.clue = 'Developed at Caltech in 1935, this logarithmic measure rates the magnitude of earthquakes.';
    },
  },
  {
    id: 'moores-law',
    test: (_row, next) => /Moore's law/i.test(next.clue),
    apply: (next) => {
      next.clue =
        "Moore's law originally predicted the transistor count on integrated circuits would double after this many years.";
      next.answer = 'Two years';
      next.aliases = ['2 years', 'two years', '24 months'];
    },
  },
  {
    id: 'ny-harbor-statue',
    test: (row, next) => /New York harbor statue/i.test(next.clue) && /Statue of Liberty/i.test(row.answer ?? ''),
    apply: (next) => {
      next.clue = 'This colossal figure in New York Harbor was a gift from France.';
    },
  },
  {
    id: 'kick-the-can',
    test: (_row, next) => /kick the can down the what/i.test(next.clue),
    apply: (next) => {
      next.clue = 'In this idiom, delaying action is kicking the can farther down this.';
      next.value = 200;
      next.difficulty_rank = 1;
    },
  },
];

/**
 * Applies the first matching override to `next` (mutating it).
 * Returns the override id if one applied, otherwise null.
 */
export function applyManualClueOverrides(next, row) {
  for (const override of MANUAL_CLUE_OVERRIDES) {
    if (override.test(row, next)) {
      override.apply(next);
      return override.id;
    }
  }
  return null;
}
