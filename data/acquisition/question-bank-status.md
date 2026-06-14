# Question Bank Status

Last updated: 2026-06-01

## Active Bank

The Supabase `questions` table is back to 1,000 active questions after provider rows that were true/false, multiple-choice-shaped, or editorially poor fits were deactivated and replaced with original topoff clues.

| Category | Active Questions |
| --- | ---: |
| Arts & Visual Culture | 100 |
| Geography | 100 |
| History | 100 |
| Language & Wordplay | 100 |
| Literature & Books | 100 |
| Music & Performing Arts | 100 |
| Pop Culture, Media & Modern Life | 100 |
| Religion, Mythology & Philosophy | 100 |
| Science | 100 |
| Sports, Games & Leisure | 100 |

## Active Provenance

| Source | Active Questions |
| --- | ---: |
| `manual_seed` | 15 |
| `opentdb` | 479 |
| `original_gap_pack` | 196 |
| `original_topoff_pack` | 310 |

## Active Difficulty Mix

| Value | Active Questions |
| --- | ---: |
| $200 | 227 |
| $400 | 444 |
| $600 | 257 |
| $800 | 72 |
| $1000 | 0 |

## Notes

- OpenTDB filled most categories, but it does not meaningfully cover Language & Wordplay and ran dry in Arts and Religion/Mythology/Philosophy.
- `original_gap_pack` fills those undercovered areas with original reviewable clues.
- `original_topoff_pack` added 310 original clues and returned every primary category to 100 active questions.
- Pop Culture overshot during provider import; 16 extra OpenTDB Pop Culture rows were left in the database but marked `is_active = false`.
- OpenTDB content remains provider text and should be treated as provisional MVP volume with CC BY-SA attribution obligations.
- A later cleanup deactivated 227 active OpenTDB rows with true/false answers or multiple-choice wording such as "which of the following."
- OpenTDB difficulty was recalibrated down one notch because provider `medium` and `hard` rows were reading easier than the original $600/$1000 mapping. New OpenTDB imports now map `medium` to $400 and `hard` to $800.
- Mobile feedback fixes corrected the Moore's law answer/unit clue, removed an answer-word leak from the Statue of Liberty clue, removed a trailing-ellipsis clue, and lowered the "kick the can down the road" idiom from $600 to $200.
- A broader rewrite pass corrected 90 live-test-style issues: visible answer words, vague unit/numeric prompts, "the what" idiom conversions, and a handful of provider rows with malformed free-response answers.
- A conservative difficulty calibration changed 217 values: 163 rows were lowered and 54 were raised. Existing $1000 rows were lowered because they did not meet the new tournament-level standard; future $1000 inventory should be deliberately authored rather than inherited from provider `hard` rows.
- The latest Jeopardy-style audit evaluated all 1,000 active questions as `strong` fit, with 0 `usable`, `weak`, or `bad_fit` active rows remaining.
- A stricter editorial quality audit is now the better working signal. After the topoff and polish pass, all 1,000 active rows are `keep`, with 0 `rewrite`, `replace`, or `deactivate` active rows remaining.
- The feedback-shaped audit now has 0 high-priority suspects remaining. Its remaining medium/low rows are mostly intentional answer-class overlap, numerical answer forms, or wordplay rows queued for optional future polish.
- Migration `007_question_quality_status.sql` adds persisted quality metadata and updates `get_recommended_questions` to exclude `replace` and `deactivate` rows.
- Intake scripts now run the shared quality gate before import, including a light polish pass for short-but-answerable clues.
