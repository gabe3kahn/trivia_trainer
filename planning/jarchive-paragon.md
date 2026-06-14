# J! Archive As Paragon

J! Archive is a fan-maintained archive of real, aired Jeopardy clues with their
board values. For this project it is the **paragon** — the reference standard —
for two separate things:

1. **Well-written clues.** Real board clues are declarative, anchored, and have a
   single expected response. They are, by definition, the shape we want our own
   clues to take.
2. **Difficulty.** A clue's board row ($200–$1000) is a real-world difficulty
   label produced by professional writers and tested on contestants.

We treat it as a **calibration source, not a content source.** Per
`product-plan.md`, we do not scrape it aggressively or redistribute its clues.
The tooling fetches a small sample of games with a polite delay, measures against
it in memory, and persists only aggregate statistics and source references
(game/round/column/row) — never the clue or answer text.

## How it is wired

A single loader, `tools/acquisition/jarchive-source.mjs`, fetches and parses the
sample. Two benchmark scripts consume it:

### Difficulty: are our values right?

`tools/acquisition/benchmark-jarchive-difficulty.mjs` runs `evaluateDifficulty`
over each real clue and compares our suggested rank to the actual board row.

Beyond drift counts it now emits a **calibration block**:

- `overall_bias` and `mean_absolute_error` across the sample.
- `by_actual_rank`: for each real rank, the mean suggested rank and the **bias**
  (`mean(suggested) − actual`). Negative bias means we systematically rate that
  tier too easy; positive means too hard.
- `confusion`: for each actual rank, the distribution of ranks we assigned.

This is the concrete signal for retuning the weights in `difficulty-rules.mjs`.
Adjust, re-run, and watch the bias move toward zero — but keep changes
conservative and review the distribution rather than chasing exact matches.

### Quality: are our rules too harsh?

`tools/acquisition/benchmark-jarchive-quality.mjs` runs the live intake
assessment (`assessQuestionForIntake`) over each real clue.

The logic that makes J! Archive a paragon here: a real aired clue is well-written,
so the **expected** decision is `keep` (or at most `rewrite`). If our rules say
`replace` or `deactivate`, that's a **false positive** — a rule too harsh for a
genuinely good clue. The report surfaces:

- `accept_rate` (keep + rewrite) and `gating_false_positive_rate`
  (replace + deactivate).
- `false_positive_issue_counts`: the rules firing on clues we'd wrongly reject —
  the highest-priority rules to soften.

Run it after any change to `question-quality-rules.mjs` or
`feedback-quality-rules.mjs` to confirm you haven't started rejecting good clues.

## Recommended workflow

1. Deterministic rules first (quality + difficulty), tuned against these
   benchmarks.
2. (Future) the LLM agent panel from `difficulty-standard.md` for correctness and
   borderline difficulty.
3. Real user attempt data as the long-term source of truth — item difficulty from
   how real users perform, which eventually supersedes the cold-start estimate.

The benchmarks are a calibration layer, not an autopilot: they tell you where the
models disagree with the paragon. A human reviews the drift and decides what to
change.
