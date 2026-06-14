# Jeopardy Style Guide and Bank Audit

## Reference Scope

I reviewed the latest complete month available from J! Archive's current season listing: Season 41's late-June through late-July 2025 games, ending with the July 25, 2025 season finale. I used these as a style reference only. I did not copy clue text into our database or into this document.

Sources used for style reference:

- J! Archive Season 41 index: https://www.j-archive.com/showseason.php?season=41
- Representative game page format: https://www.j-archive.com/showgame.php?game_id=9249

If by "last month" you meant a newer calendar month than the latest available J! Archive season page, we should rerun this when those games are available.

## What Jeopardy Clues Look Like

Jeopardy clues are not trivia API questions with a question mark removed. They are compact prompts that assume the player will supply the question-form response. The clue usually gives a declarative fact pattern, a category frame, and one or two carefully chosen anchors that make the intended answer retrievable.

Strong Jeopardy-style clues tend to have these traits:

- Declarative phrasing: "This..." / "These..." / "In..." / "After..." / "Named for..." rather than "What is..." or "Which of these..."
- Category dependence: the category often tells the player what kind of answer is expected, and the clue may be incomplete without that category.
- A clear answer class: person, place, work, word, year, title, body part, movement, river, etc.
- One intended response: no multiple-choice framing, no true/false, no vague opinion prompts.
- Specific anchors: dates, places, works, roles, relationships, titles, etymology, quotes, awards, offices, discoveries, or distinctive details.
- Compactness: usually one sentence, often around 10-30 words, with minimal explanatory padding.
- Learnable misdirection: a clue may be playful or indirect, but it still rewards knowledge rather than guessing from options.
- Accepted-response awareness: last names, alternate spellings, articles, and common aliases need to be captured.
- Difficulty progression: easy clues use famous facts and direct anchors; harder clues use less famous works, second-order associations, or narrower details.
- Category wordplay: letter constraints, "Before & After," quotation categories, puns, and fill-in categories are common, but the constraint must actually be answerable.

Weak Jeopardy-style clues usually have these problems:

- They ask a direct question instead of presenting a clue.
- They depend on multiple-choice options that are no longer visible.
- They have true/false answers.
- They are too short to train anything beyond a flashcard association.
- They lack a category-specific angle.
- They include provider wording like "which of the following" or "which one of these."
- They give the answer class poorly, causing ambiguous typed answers.

## Working Rubric

Use this as the review target for generated/imported clues:

| Dimension | Good Target |
| --- | --- |
| Form | Declarative clue, not direct quiz question |
| Answerability | One clear intended answer |
| Category fit | Category helps interpret the clue |
| Specificity | Includes at least one strong anchor |
| Concision | Tight but not skeletal |
| Difficulty | Point value matches obscurity and reasoning load |
| Free response | No dependency on choices |
| Response handling | Aliases and alternate spellings included |
| Voice | Polished, clue-like, not API/plain textbook |
| Mechanics | Wordplay constraints are valid and visible |

## Database Evaluation

I evaluated the active Supabase question bank with a heuristic style scorer. It penalizes direct-question form, interrogative starts, multiple-choice-shaped wording, true/false answers, weak clue anchors, low specificity, awkward length, missing aliases, and provider wording. This is not a final editorial review, but it is useful for triage.

Generated artifact:

- `data/acquisition/jeopardy-style-evaluation.json`

Overall active bank:

| Metric | Count |
| --- | ---: |
| Active questions evaluated | 773 |
| Average style score | 62 |
| Strong | 213 |
| Usable | 144 |
| Weak | 200 |
| Bad fit | 216 |

By source:

| Source | Count | Avg Score | Strong | Usable | Weak | Bad Fit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `manual_seed` | 15 | 97 | 13 | 2 | 0 | 0 |
| `original_gap_pack` | 197 | 96 | 187 | 10 | 0 | 0 |
| `opentdb` | 561 | 49 | 13 | 132 | 200 | 216 |

By category:

| Category | Count | Avg Score | Strong | Usable | Weak | Bad Fit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arts & Visual Culture | 87 | 74 | 51 | 3 | 7 | 26 |
| Geography | 71 | 46 | 2 | 14 | 21 | 34 |
| History | 69 | 49 | 4 | 12 | 27 | 26 |
| Language & Wordplay | 100 | 93 | 89 | 11 | 0 | 0 |
| Literature & Books | 84 | 53 | 5 | 25 | 29 | 25 |
| Music & Performing Arts | 73 | 48 | 2 | 10 | 38 | 23 |
| Pop Culture, Media & Modern Life | 70 | 50 | 4 | 18 | 18 | 30 |
| Religion, Mythology & Philosophy | 84 | 82 | 52 | 11 | 13 | 8 |
| Science | 64 | 45 | 2 | 7 | 21 | 34 |
| Sports, Games & Leisure | 71 | 59 | 2 | 33 | 26 | 10 |

Most common issues:

| Issue | Count |
| --- | ---: |
| Provider wording | 561 |
| Direct-question form | 545 |
| Starts with interrogative | 373 |
| Weak clue anchor | 285 |
| Missing aliases for multiword answer | 251 |
| Too short | 66 |
| Low specificity | 18 |

## Interpretation

The core problem is not the app UI anymore; it is the source mix. The original/manual clues are already much closer to Jeopardy style. The OpenTDB rows are useful for quick testing, but most of them are still quiz questions rather than clues. Even when the app transforms punctuation or changes display framing, the underlying wording often remains direct, under-anchored, and not category-dependent.

The strongest categories are the ones with the most original gap-pack material: Language & Wordplay, Religion/Mythology/Philosophy, and Arts. The weakest categories are the ones still dominated by OpenTDB phrasing: Science, Geography, Music, History, and Pop Culture.

## Recommendation

Short term:

- Keep OpenTDB rows active only as provisional filler.
- Prefer `manual_seed` and `original_gap_pack` rows in `get_recommended_questions`.
- Add a `style_score` or `review_status` field so the app can avoid weak provider rows.
- Generate original Jeopardy-style replacement packs for Science, Geography, History, Music, Literature, Sports, and Pop Culture.
- Treat the heuristic Jeopardy-style score as a formatting gate, not as final editorial approval.
- Use the stricter question-quality audit before surfacing clues heavily in training sessions.

Medium term:

- Treat "100 per category" as an editorial target, not just a row count.
- Build a review pipeline where each clue must pass:
  - free-response check,
  - Jeopardy-form check,
  - ambiguity check,
  - alias check,
  - difficulty check.

Long term:

- Use open structured sources like Wikidata for facts, then write original clue wording from templates.
- Store provenance for facts separately from clue text.
- Make OpenTDB a fallback/testing provider, not the main training bank.

## Stricter Editorial Quality Review

After mobile testing exposed confusing clues that still passed the style scorer, I added a second audit focused on answerability and player experience rather than surface Jeopardy shape.

Generated artifacts:

- `tools/acquisition/audit-question-quality.mjs`
- `data/acquisition/question-quality-audit.json`
- `data/acquisition/question-quality-review.md`

Current active bank under the stricter review, after removing the first `replace` and `deactivate` rows from rotation, rewriting the remaining recommended rows, and importing the original topoff pack:

| Decision | Count |
| --- | ---: |
| Keep | 1000 |
| Rewrite | 0 |
| Replace | 0 |
| Deactivate | 0 |

The bank is back to 100 active clues in each primary category. OpenTDB remains the weaker provenance layer and should gradually be replaced, but the active rows now pass both the stricter quality audit and the Jeopardy-style scorer.

This means the next question-bank step should be editorial replacement by source/provenance and targeted difficulty calibration, not emergency cleanup. The app-side mitigation remains persisted quality metadata plus import-time gating so new `replace` or `deactivate` rows cannot enter training by accident.

Migration `007_question_quality_status.sql` implements the database side by adding `quality_status`, `quality_score`, and `quality_issues` to `questions`, loading audit classifications, and updating `get_recommended_questions` to filter out `replace` and `deactivate` rows. The intake scripts now apply the same shared quality rules before import.
