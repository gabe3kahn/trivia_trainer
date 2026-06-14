# Difficulty Standard

This standard is for assigning Jeopardy-style dollar values to original trainer clues. It should be treated as the editorial starting point; user attempt data should become the long-term source of truth.

## Core Scale

| Value | Label | Standard |
| ---: | --- | --- |
| $200 | Recognition | A broadly familiar answer with a direct, generous clue. A casual trivia player should usually know it once the anchor is seen. |
| $400 | Core Recall | A standard trivia fact with a clear answer class and at least one strong anchor. A regular player should often know it, but it requires recall rather than pure recognition. |
| $600 | Competitive Recall | A slightly deeper fact, a less famous answer, or a familiar answer reached through a more specific clue. A good player may know it, but misses should be normal. |
| $800 | Specialist | A deep-cut fact, exact detail, less common work/person/place, or a clue that requires category strength. A strong player should not be expected to know most of these cold. |
| $1000 | Tournament | Niche, multi-step, exacting, or specialist material where the clue is fair but demanding. These should feel satisfying to get, not merely obscure. |

## Evaluation Axes

Each clue should be judged on five axes:

| Axis | Easier | Harder |
| --- | --- | --- |
| Answer fame | Canonical household answer | Minor person/work/detail |
| Clue generosity | Direct title, role, location, or date | Oblique association or secondary fact |
| Answer form | Single expected answer, common aliases | Exact year, number, technical term, spelling-sensitive name |
| Cognitive work | Recognition or one-hop recall | Cross-domain, quote completion, chronology, or comparison |
| Category expectation | Common category material | Specialist subcategory material |

## Calibration Rules

- If the clue contains a very strong canonical hook, the value should usually be $200 or $400 even if the answer feels "important."
- Exact years, small numerical facts, and technical terms should usually start at $600 unless the clue is extremely famous.
- Wordplay can be $200 when the word path is transparent; it should rise only when both the clue and the transformation are demanding.
- A clue should not become harder because it is vague. Vague clues are quality problems, not difficulty.
- If the answer's "meaty" content word appears in the clue, lower the difficulty only after rewriting; leakage is not a valid easy clue.
- OpenTDB/provider difficulty is a hint, not a standard. In this app, provider `easy` maps to $200, `medium` to $400, and `hard` usually maps to $800 unless rewritten by hand.

## Agent Testing Model

A range of difficulty-testing agents is possible and useful as a calibration layer. The recommended panel:

| Agent | Purpose |
| --- | --- |
| Casual Player | Detects whether $200 clues are actually accessible. |
| Pub Trivia Regular | Helps separate $400 from $600. |
| Jeopardy Watcher | Tests whether clues feel show-like and answerable from phrasing. |
| Tournament Aspirant | Helps separate $800 from $1000. |
| Domain Specialist | Spots false difficulty in niche categories and catches wrong assumptions. |

The agents should not decide final values by themselves. The best workflow is: deterministic audit first, agent panel second, real user attempt data third. If agents disagree sharply, the clue goes into a manual review queue.
