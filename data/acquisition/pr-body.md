## Draft summary — 2026-07-06

Three packs drafted, all passed dry-run gate (40/40 clues, 0 bank collisions).

---

### History (15 clues)

Targets the $1000-underweight tier. Fills Historical Figures, World Wars, European History, Ancient History, U.S. History, and Empires gaps.

| Value | Answer | Subcategory |
|-------|--------|-------------|
| $200 | Underground Railroad | U.S. History |
| $400 | Franz Ferdinand | World Wars |
| $400 | John Glenn | Historical Figures |
| $400 | Louis XIV | European History |
| $600 | Hannibal | Ancient History |
| $600 | Malcolm X | Historical Figures |
| $600 | Dwight D. Eisenhower | Historical Figures |
| $600 | Earl of Sandwich | Historical Figures |
| $800 | Memphis Belle | World Wars |
| $800 | Holodomor | European History |
| $800 | Edict of Nantes | European History |
| $800 | Munich | European History |
| $1000 | Siege of Leningrad | World Wars |
| $1000 | Fabian Strategy | Ancient History |
| $1000 | Kievan Rus' | European History |

**Difficulty calibration note:** Dry-run flagged 1 clue for $800→$600 recalibration and 4 for rewrite; critic pass will address.

---

### Literature & Books (15 clues)

Targets the $1000-underweight tier. Fills American Literature, British & Irish, World Literature, Children's, Awards/Terms, and Authors & Works gaps.

| Value | Answer | Subcategory |
|-------|--------|-------------|
| $200 | Peter Rabbit | Children's & Young Adult Literature |
| $400 | The Catcher in the Rye | American Literature |
| $400 | Stephen King | American Literature |
| $400 | The Wind in the Willows | British & Irish Literature |
| $400 | Animal Farm | British & Irish Literature |
| $600 | James Fenimore Cooper | American Literature |
| $600 | Edith Wharton | American Literature |
| $600 | Watership Down | British & Irish Literature |
| $600 | Soliloquy | Awards, Movements & Terms |
| $600 | Albert Camus | World Literature |
| $800 | Joan Didion | American Literature |
| $800 | The Velveteen Rabbit | Children's & Young Adult Literature |
| $1000 | Baron Munchausen | World Literature |
| $1000 | The Amazing Adventures of Kavalier & Clay | American Literature |
| $1000 | Absalom, Absalom! | American Literature |

**Dry-run quality gate:** keep=13, rewrite=2; critic pass will address rewrites.

---

### Wordplay (10 clues)

Mechanics rotation: **anagram** (5) + **crossword** (5). Last anagram run: 2026-06-28; last crossword run: 2026-06-27.

| Value | Mechanic | Answer | Scramble/Pattern |
|-------|----------|--------|-----------------|
| $400 | anagram | Prose | ropes |
| $400 | anagram | Spine | snipe |
| $600 | anagram | Pleat | leapt |
| $600 | anagram | Pirates | traipse |
| $800 | anagram | Tides | edits |
| $400 | crossword | BYTE | `_ Y _ _` |
| $400 | crossword | HERON | `_ _ _ _ N` |
| $600 | crossword | WHARF | `_ _ _ R _` |
| $600 | crossword | WALTZ | `_ _ _ T _` |
| $800 | crossword | SMOCK | `_ _ _ _ K` |

---

## Editorial critic — revise pass applied

**9 clues revised, 0 dropped, 6 critique verdicts overridden.**

### Fixes applied (9)

| Pack | ID | Issue | Fix |
|------|----|-------|-----|
| history | 006 Malcolm X | **leak** — clue named "the letter 'X'", exposing the answer's surname | Rewrote: replaced "the letter 'X'" with "a symbol of his unknown African ancestral name"; added birth surname 'Little' |
| history | 011 Edict of Nantes | **factual** — "waves of forced conversion" contradicts the source (singular dragonnades) | Applied suggested fix: "a wave of dragonnades and forced conversion" |
| history | 013 Siege of Leningrad | **leak** — "siege" appeared verbatim in answer and clue body | Applied suggested fix: "blockade" + "deadliest military encirclement" |
| history | 014 Fabian Strategy | **leak** — "Quintus Fabius Maximus" exposes the "Fabian" stem | Applied suggested fix: "Named after a Roman dictator nicknamed 'the Delayer'" |
| literature | 003 Stephen King | **alias** — bare "King" is ambiguous (MLK, BB King, etc.) | Dropped "King" from aliases |
| literature | 011 Joan Didion | **factual** — source says "the earliest," clue diluted to "one of the earliest" | Applied suggested fix: restored superlative, reordered "later" |
| literature | 012 The Velveteen Rabbit | **wording** — "serialized" implies multiple installments; source says single publication | Applied suggested fix: "had first appeared in Harper's Bazaar" |
| wordplay | ana-05 Tides | **wording** — "retreating the sea" is grammatically malformed (intransitive verb) | Applied suggested fix: "drawing the sea back" |
| wordplay | cw-03 WHARF | **related** — "Landing place where ships are loaded and unloaded" shared dock/harbor/cargo entities with two active bank clues | Rewrote definition: "Raised platform built along a waterway where vessels moor to load or discharge" |

### Critic verdicts overridden (6)

| ID | Verdict | Override reason |
|----|---------|----------------|
| history-004 Louis XIV | related (→ Edict of Nantes 011) | Different answers and different facts: 004 covers the Sun King's 72-year reign at Versailles; 011 covers the 1685 revocation of a document. Shared entity is just the historical era. |
| history-005 Hannibal | related (→ Fabian Strategy 014) | Different answers (a general vs. a military doctrine); tests distinct knowledge — the commander who crossed the Alps vs. the war-of-attrition response his Roman opponents used against him. |
| history-008 Earl of Sandwich | related (→ bank "Sandwich" words_language) | Different answers and different categories (historical person vs. word etymology); the person's role differs from the food word's origin story. |
| history-009 Memphis Belle | related (→ bank "Warsaw Uprising") | Only shared entities are the broad time period (1944, WWII); topics are completely unrelated — a specific B-17 aircraft vs. a Polish resistance uprising. |
| history-012 Munich | related (→ bank "Oktoberfest") | Only shared entities are the city's geographic identity (Bavaria, Germany, Munich); topics are completely unrelated — Nazi Party origins vs. a beer festival. |
| literature-005 Animal Farm | related (→ bank "Orwellian" + "George Orwell") | Different answers (book vs. derived adjective vs. author); tests distinct knowledge of the book's specific plot, not the adjective's meaning or the author's biography. |

### Gate results after edits

- `validate-wordplay.mjs` — ✓ 10/10 valid
- `import-to-supabase.mjs --dry-run` (history) — ✓ 15/15 pass, 0 bank collisions
- `import-to-supabase.mjs --dry-run` (literature) — ✓ 15/15 pass, 0 bank collisions
- `import-to-supabase.mjs --dry-run` (wordplay) — ✓ 10/10 pass, 0 bank collisions
