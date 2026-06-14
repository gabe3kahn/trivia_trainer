# J! Archive Quality Benchmark

Generated: 2026-06-03T05:51:08.349Z

Calibration only. J! Archive clues are not imported or persisted; only aggregates and source references are stored here.

> J! Archive clues are well-written by definition. So `keep`/`rewrite` means our rules accept the clue, while `replace`/`deactivate` on a real aired clue is a **false positive** — a rule that is too harsh and should be softened.

## Sample

| Game | Aired | Clues | URL |
| --- | --- | ---: | --- |
| 9202 | Tuesday, May 20, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9202 |
| 9171 | Thursday, April 17, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9171 |
| 9121 | Thursday, February 13, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9121 |
| 9095 | Wednesday, January 15, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9095 |
| 9086 | Monday, January 6, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9086 |

## Headline

| Metric | Value |
| --- | ---: |
| Clues | 300 |
| Accept rate (keep/rewrite) | 100% |
| Gating false-positive rate (replace/deactivate) | 0% |
| Mean quality score | 95.2 |

## Decisions

| Decision | Count |
| --- | ---: |
| keep | 283 |
| rewrite | 17 |
| replace | 0 |
| deactivate | 0 |

## Rules Firing On Clues We Wrongly Reject

These are the highest-priority rules to soften (they reject real, well-written clues).

| Issue | Count |
| --- | ---: |

## All Issue Hits (whole sample)

| Issue | Count |
| --- | ---: |
| missing-multiword-aliases | 157 |
| feedback:answer-content-word-in-clue | 12 |
| possibly-time-sensitive-pop-culture | 11 |
| overlong-clue | 1 |
| thin-clue | 1 |

## Warnings (non-scoring)

| Warning | Count |
| --- | ---: |
| unclear-answer-class | 29 |
| low-anchor-density | 14 |

Full machine-readable results: `data/acquisition/jarchive-quality-benchmark.json`
