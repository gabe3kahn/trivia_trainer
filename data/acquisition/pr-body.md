## Draft summary — 2026-07-10

Three packs drafted, all passed dry-run gate (39/39 clues, 0 bank collisions).

---

### Sports, Games & Leisure (14 clues)

Fills Rules & Terminology, Baseball, Board Games & Card Games, Olympics, Video Games, Tennis & Golf, Sports Records & Awards, and Soccer gaps.

| Value | Answer | Subcategory |
|-------|--------|-------------|
| $200 | Box score | Rules & Terminology |
| $400 | Hat-trick | Rules & Terminology |
| $400 | Bench-clearing brawl | Baseball |
| $400 | Cricket | Rules & Terminology |
| $400 | Mahjong | Board Games & Card Games |
| $400 | Fosbury Flop | Olympics |
| $600 | Grand Slam | Tennis & Golf |
| $600 | Floyd Mayweather Jr. | Sports Records & Awards |
| $600 | Fencing | Rules & Terminology |
| $600 | Water Polo | Rules & Terminology |
| $800 | Save | Baseball |
| $800 | Garry Kasparov | Board Games & Card Games |
| $1000 | Eggbeater kick | Rules & Terminology |
| $1000 | Chicago White Sox | Baseball |

**Dry-run quality gate:** keep=14, rewrite=0, replace=0.

---

### Literature & Books (15 clues)

Fills Shakespeare & Drama, Children's & YA, 19th-Century Novels, Poetry, World Literature, American Literature, Authors & Works, and Literary Characters gaps.

| Value | Answer | Subcategory |
|-------|--------|-------------|
| $400 | Much Ado About Nothing | Shakespeare & Drama |
| $400 | The Hunger Games | Children's & Young Adult Literature |
| $400 | Daniel Deronda | 19th-Century Novels |
| $600 | Rainer Maria Rilke | Poetry |
| $600 | Captains Courageous | World Literature |
| $600 | The Road | American Literature |
| $600 | Small Mercies | American Literature |
| $600 | Isabel Allende | World Literature |
| $600 | Northanger Abbey | 19th-Century Novels |
| $800 | Arthur Conan Doyle | Authors & Works |
| $800 | Lady Macbeth | Literary Characters |
| $800 | Colson Whitehead | American Literature |
| $800 | The Seagull | Shakespeare & Drama |
| $1000 | Coriolanus | Shakespeare & Drama |
| $1000 | Mansfield Park | 19th-Century Novels |

**Dry-run quality gate:** keep=15, rewrite=0, replace=0.

---

### Wordplay (10 clues)

Mechanics rotation: **before_after** (5) + **homophone** (5). Last before_after run: 2026-07-06; last homophone run: 2026-07-06.

| Value | Mechanic | Answer | Pivot / Soundalike |
|-------|----------|--------|--------------------|
| $400 | before_after | Pencil Case Study | Case |
| $400 | before_after | Apple Pie Chart | Pie |
| $400 | before_after | Mountain Dew Drop | Dew |
| $600 | before_after | Flash Mob Rule | Mob |
| $600 | before_after | Time Zone Defense | Zone |
| $400 | homophone | Stare | stair |
| $400 | homophone | Gait | gate |
| $400 | homophone | Doe | dough |
| $600 | homophone | Whale | wail |
| $600 | homophone | Scent | sent |

**Dry-run quality gate:** keep=10, rewrite=0, replace=0.

---

## Editorial critic

**11 clues revised, 0 dropped.**

### Revisions applied

| Pack | ID | Change |
|------|----|--------|
| literature_books | lit-003 Daniel Deronda | Value $400→$600 (difficulty_fit: triangulation clue under-priced) |
| literature_books | lit-008 Isabel Allende | Alias "Allende"→"Allende (novelist)" (collision with Salvador Allende) |
| literature_books | lit-011 Lady Macbeth | Value $800→$600 (difficulty_fit: iconic traits, over-priced) |
| literature_books | lit-012 Colson Whitehead | Removed "back-to-back award cycles" (factual: 2017 and 2020 are three cycles apart, not consecutive) |
| sports_games_leisure | sgl-003 Bench-clearing brawl | Added "or benches" to location list (factual: ice hockey players leave benches, not dugouts/bullpens) |
| sports_games_leisure | sgl-010 Water Polo | Rewrote clue to fix punctuation (comma outside single quote) and remove single-quote framing |
| sports_games_leisure | sgl-014 Chicago White Sox | Fixed name-adoption date: arrived Chicago 1900 as White Stockings; "White Sox" not until 1904 |
| wordplay | wordplay-2026-07-10-ba-01 Flash Mob Rule | Rewrote: old clue made Flash Mob a direct illustration of Mob Rule (thematic link); two separate, unconnected scenes now |
| wordplay | wordplay-2026-07-10-ba-03 Apple Pie Chart | Rewrote: removed "inspired" causal link between pastry and pie chart |
| wordplay | wordplay-2026-07-10-ba-05 Mountain Dew Drop | Rewrote: split into two separate characters (road tripper / nature photographer) to remove single-scene thematic link |
| wordplay | wordplay-2026-07-10-hp-05 Doe | Rewrote: moved away from baking context (shared "baking, flour" with bank "Flour" clue); "dough" now used in financial-slang sense |

### Critique overrides

| ID | Flag | Reason kept |
|----|------|-------------|
| sgl-001 Box score | related: Bench-clearing brawl, Save | Different answers (tabular format vs. fight event vs. pitching stat); surface topic overlap only |
| sgl-006 Fosbury Flop | related: bank "Dick Fosbury" | Different answers (technique vs. person); clue already avoids naming Fosbury directly |
| sgl-007 Grand Slam | related: bank Federer, Borg, Wimbledon | Different answers (definition of the term vs. specific players/tournament) |
| sgl-011 Save | related: Box score | Different answers; box score tests the format, save tests the specific pitching statistic |
| sgl-012 Eggbeater kick | related: Water Polo (this run) | Different answers (named technique vs. sport); co-presence in a run is expected |
| lit-003 Daniel Deronda | related: bank "George Eliot" | Different answers (novel vs. author); value bump to $600 addresses difficulty concern |
| lit-011 Lady Macbeth | related: bank "Macbeth" | Different answers (character vs. play title); value drop to $600 addresses the difficulty concern |

---

## Gate results (after revise pass)

- `validate-wordplay.mjs` — ✓ 10/10 valid
- `import-to-supabase.mjs --dry-run` (sports_games_leisure) — ✓ Dry run OK (14/14)
- `import-to-supabase.mjs --dry-run` (literature_books) — ✓ Dry run OK (15/15)
- `import-to-supabase.mjs --dry-run` (wordplay) — ✓ Dry run OK (10/10)
