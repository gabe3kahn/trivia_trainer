# J! Archive Difficulty Benchmark

Generated: 2026-06-03T05:49:45.188Z

This is a calibration benchmark only. J! Archive clues are not imported into the app question bank.

## Sample

| Game | Aired | Clues | URL |
| --- | --- | ---: | --- |
| 9202 | Tuesday, May 20, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9202 |
| 9171 | Thursday, April 17, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9171 |
| 9121 | Thursday, February 13, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9121 |
| 9095 | Wednesday, January 15, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9095 |
| 9086 | Monday, January 6, 2025 | 60 | https://j-archive.com/showgame.php?game_id=9086 |

## Overall

| Metric | Value |
| --- | ---: |
| Clues | 300 |
| Exact row match | 64% |
| Within one row | 100% |
| Avg delta rank | 0.14 |
| Avg absolute delta rank | 0.36 |
| Suggested easier than J! row | 33 |
| Suggested same as J! row | 192 |
| Suggested harder than J! row | 75 |

## By Actual Value

| Actual Value | Count | Exact | Within 1 | Avg Delta | Suggested Easier | Same | Harder |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| $200 | 60 | 28.3% | 100% | 0.72 | 0 | 17 | 43 |
| $400 | 60 | 58.3% | 100% | 0.42 | 0 | 35 | 25 |
| $600 | 60 | 88.3% | 100% | 0.12 | 0 | 53 | 7 |
| $800 | 60 | 85% | 100% | -0.15 | 9 | 51 | 0 |
| $1000 | 60 | 60% | 100% | -0.4 | 24 | 36 | 0 |

## Calibration vs J! Archive

Mean absolute rank error: **0.36** · Overall bias: **0.14** (negative = we rate too easy)

| Actual Value | Count | Mean Suggested Rank | Bias | MAE |
| ---: | ---: | ---: | ---: | ---: |
| $200 | 60 | 1.72 | +0.72 | 0.72 |
| $400 | 60 | 2.42 | +0.42 | 0.42 |
| $600 | 60 | 3.12 | +0.12 | 0.12 |
| $800 | 60 | 3.85 | -0.15 | 0.15 |
| $1000 | 60 | 4.6 | -0.4 | 0.4 |

## Largest Drift Samples

| Actual | Suggested | Delta | Category | Source Ref | Reasons |
| ---: | ---: | ---: | --- | --- | --- |
| $400 | $600 | 1 | PLAYS & PLAYWRIGHTS | DJ_4_2 | specific-answer-form, long-answer-form, direct-canonical-hook, specific-detail-hook |
| $600 | $800 | 1 | 18th CENTURY AVIATION | J_3_3 | specific-answer-form, long-answer-form, few-strong-clue-anchors, specialized-category-title |
| $400 | $600 | 1 | ALMA MATERS | DJ_1_2 | specific-answer-form, long-answer-form, few-strong-clue-anchors, specialized-category-title |
| $600 | $800 | 1 | NOT ON MY WATCH | J_1_3 | specific-answer-form, long-answer-form, direct-canonical-hook, negative-logic |
| $600 | $800 | 1 | POP CULTURE JEOPARDY! | DJ_5_3 | specific-answer-form, long-answer-form, few-strong-clue-anchors, direct-canonical-hook |
| $400 | $600 | 1 | U.S. HISTORY | DJ_5_2 | specific-answer-form, long-answer-form, numeric-answer |
| $600 | $800 | 1 | SILVER | J_2_3 | specific-answer-form, long-answer-form, few-strong-clue-anchors |
| $200 | $400 | 1 | ADDRESSES | DJ_3_1 | specific-answer-form, long-answer-form, few-strong-clue-anchors |
| $200 | $400 | 1 | HISTORIC HISTORY | J_1_1 | specific-answer-form, long-answer-form, few-strong-clue-anchors |
| $400 | $600 | 1 | STATE CAPITALS | DJ_4_2 | specific-answer-form, long-answer-form, many-strong-clue-anchors, specialized-category-title |
| $600 | $800 | 1 | THE 19th CENTURY | DJ_1_3 | specific-answer-form, long-answer-form, many-strong-clue-anchors, specialized-category-title |
| $200 | $400 | 1 | WEIGHTS & MEASURES | DJ_4_1 | long-answer-form, few-strong-clue-anchors, specialized-category-title |
| $600 | $800 | 1 | CANADIAN LAKES | DJ_2_3 | long-answer-form, few-strong-clue-anchors, specialized-category-title |
| $200 | $400 | 1 | SPITTIN' SCIENCE FACTS | J_5_1 | long-answer-form, few-strong-clue-anchors, specialized-category-title |
| $600 | $800 | 1 | FLAGS! | J_5_3 | specific-answer-form, few-strong-clue-anchors, specialized-category-title |
| $200 | $400 | 1 | PALINDROMIC WORDS | J_3_1 | few-strong-clue-anchors, short-clue, category-gimmick |
| $200 | $400 | 1 | ALLITERATION ON THE MAP | DJ_1_1 | specific-answer-form, long-answer-form, short-clue |
| $400 | $600 | 1 | CANADIAN LAKES | DJ_2_2 | specific-answer-form, few-strong-clue-anchors, direct-recognition-hook, specialized-category-title |
| $200 | $400 | 1 | GIVE US 2 WORDS | DJ_6_1 | long-answer-form, many-strong-clue-anchors, category-gimmick |
| $400 | $600 | 1 | THE VICE PRESIDENT WHO... | DJ_1_2 | specific-answer-form, long-answer-form, direct-canonical-hook |
| $400 | $600 | 1 | 2-WORD CITIES | J_2_2 | specific-answer-form, category-gimmick |
| $400 | $600 | 1 | ALBUMS | J_2_2 | specific-answer-form, long-answer-form, many-strong-clue-anchors |
| $200 | $400 | 1 | STARS OF STAGE & SCREEN | DJ_3_1 | specific-answer-form, long-answer-form, many-strong-clue-anchors |
| $400 | $600 | 1 | A LITTLE LOVE POETRY | DJ_2_2 | specific-answer-form, generous-clue-length, negative-logic, specialized-category-title |
| $200 | $400 | 1 | A + (DIRECTOR'S NAME) + (WORD FOR A MOVIE) | DJ_6_1 | specific-answer-form, many-strong-clue-anchors, category-gimmick |

Full machine-readable results: `data/acquisition/jarchive-difficulty-benchmark.json`
