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

## Gate results

- `validate-wordplay.mjs` — ✓ 10/10 valid
- `import-to-supabase.mjs --dry-run` (sports_games_leisure) — ✓ 14/14 pass, 0 bank collisions
- `import-to-supabase.mjs --dry-run` (literature_books) — ✓ 15/15 pass, 0 bank collisions
- `import-to-supabase.mjs --dry-run` (wordplay) — ✓ 10/10 pass, 0 bank collisions
