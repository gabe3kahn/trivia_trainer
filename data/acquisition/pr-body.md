# Daily Draft — 2026-07-11

Two sourced category packs + one wordplay pack. All gates clean.

---

## religion_mythology_philosophy — 15 clues

Tier spread: $200×3 / $400×3 / $600×3 / $800×3 / $1000×3

| # | Value | Subcategory | Answer |
|---|-------|-------------|--------|
| 1 | $200 | Bible | Garden of Eden |
| 2 | $200 | Symbols, Rituals & Holidays | Seven Deadly Sins |
| 3 | $200 | World Religions | Mother Teresa |
| 4 | $400 | Religious Texts & Terms | Hadith |
| 5 | $400 | Religious Texts & Terms | Vedas |
| 6 | $400 | Symbols, Rituals & Holidays | Basilica |
| 7 | $600 | Roman & Norse Mythology | Frigg |
| 8 | $600 | Philosophers | William James |
| 9 | $600 | World Religions | Samsara |
| 10 | $800 | Greek Mythology | Odysseus |
| 11 | $800 | Religious Texts & Terms | Biblical Apocrypha |
| 12 | $800 | Philosophers | Thomas Carlyle |
| 13 | $1000 | Philosophical Schools | Absurdism |
| 14 | $1000 | World Religions | Moksha |
| 15 | $1000 | Roman & Norse Mythology | Fenrir |

Sources: Wikipedia leads for Garden of Eden, Seven Deadly Sins, Mother Teresa, Hadith, Hinduism (×3), Basilica, Odin (×2), William James, Odysseus, Biblical apocrypha, Thomas Carlyle, Albert Camus.

---

## music_performing_arts — 15 clues

Tier spread leans toward under-weight $200 and $1000 per active-bank signal: $200×2 / $400×4 / $600×4 / $800×2 / $1000×3

| # | Value | Subcategory | Answer |
|---|-------|-------------|--------|
| 1 | $200 | Popular Music | Adele |
| 2 | $200 | Instruments | Cello |
| 3 | $400 | Film Scores & Soundtracks | John Williams |
| 4 | $400 | Opera | Opera buffa |
| 5 | $400 | Popular Music | The Who |
| 6 | $400 | Popular Music | Tutti Frutti |
| 7 | $600 | Jazz & Blues | Bossa Nova |
| 8 | $600 | Opera | Aria |
| 9 | $600 | Instruments | Harpsichord |
| 10 | $600 | Opera | Giuseppe Verdi |
| 11 | $800 | Jazz & Blues | Miles Davis |
| 12 | $800 | Popular Music | Ice Cube |
| 13 | $1000 | Popular Music | Bone Thugs-n-Harmony |
| 14 | $1000 | Popular Music | Olivia Dean |
| 15 | $1000 | Opera | Der Ring des Nibelungen |

Sources: Wikipedia leads for Adele, Cello, John Williams, Opera buffa, The Who, Tutti Frutti (song), Bossa nova, Aria, Harpsichord, Giuseppe Verdi, Miles Davis, Ice Cube, Bone Thugs-n-Harmony, Olivia Dean, Der Ring des Nibelungen.

---

## wordplay-2026-07-11 — 10 clues

Mechanics: **rhyme_time** (5) + **initials** (5). Rotation: this pairing last used 2026-06-29.

**Rhyme Time**

| # | Value | Answer | Rhyme pair |
|---|-------|--------|-----------|
| 1 | $200 | Wild Child | wild / child |
| 2 | $400 | Plain Jane | plain / jane |
| 3 | $400 | Night Light | night / light |
| 4 | $600 | Double Trouble | double / trouble |
| 5 | $600 | Slick Trick | slick / trick |

**Initials & Abbreviations**

| # | Value | Answer | Initials |
|---|-------|--------|---------|
| 6 | $400 | Panama Canal | P.C. |
| 7 | $600 | Bermuda Triangle | B.T. |
| 8 | $600 | Trojan Horse | T.H. |
| 9 | $800 | Pythagorean Theorem | P.T. |
| 10 | $1000 | Cognitive Dissonance | C.D. |

---

## Gates

- `verify-clue-sources --write-back`: religion 15/15 verified, music 15/15 verified
- `validate-wordplay`: 10/10 valid
- `import-to-supabase --dry-run`: all three packs clean (no collisions, no schema errors)

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

### Pass 1 — history + literature + wordplay (anagram/crossword)

**9 clues revised, 0 dropped, 6 critique verdicts overridden.**

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

Overrides (6): history-004 Louis XIV, history-005 Hannibal, history-008 Earl of Sandwich, history-009 Memphis Belle, history-012 Munich, literature-005 Animal Farm — all `related` flags where answers and tested knowledge are genuinely distinct; shared entities are incidental era/geography overlap, not duplicated questions.

Gate results (pass 1): `validate-wordplay` ✓ 10/10 · `import --dry-run` history ✓ · literature ✓ · wordplay ✓

---

### Pass 2 — music_performing_arts + religion_mythology_philosophy + wordplay-2026-07-11

**21 clues revised, 0 dropped, 0 critic verdicts overridden.**

#### music_performing_arts (7 revised)

| ID | Issue | Fix |
|----|-------|-----|
| mpa-001 Adele | **leak** — "born Adele Laurie Blue Adkins" contains the answer verbatim | Removed birth name; clue now opens with "This English singer-songwriter has sold…" |
| mpa-002 Cello | **alias** — "Violoncello" (an alias) named in the clue body | Replaced with suggested clue leading with playing position; no alias exposure |
| mpa-004 Opera buffa | **alias** — "Italian comic opera" embeds the alias "Comic Opera" | Added descriptive phrase ("everyday settings, vernacular characters, and humorous tone") in place of the alias label |
| mpa-005 The Who | **factual** — John Entwistle absent from the named founding lineup | Added "John Entwistle" to complete the four-member classic lineup |
| mpa-006 Tutti Frutti | **factual** — refrain transcribed as "bop-a-loo-bop-a-wop-bam-boom"; source says "bop-a-loo-mop-a-lop-bam-boom" | Corrected two syllables: "mop" and "lop" |
| mpa-007 Bossa Nova | **factual** — described as derived from "cool jazz"; source calls this a common misconception; **wording** — dangling participial clause after semicolon | Applied suggested clue: removes jazz-derivation claim, adds grammatical subject "it" |
| mpa-012 Ice Cube | **alias** — "Born O'Shea Jackson" names the alias verbatim | Removed birth-name clause; clue now leads with "This Los Angeles-born rapper…" |

#### religion_mythology_philosophy (12 revised)

| ID | Issue | Fix |
|----|-------|-----|
| rmp-003 Mother Teresa | **alias** — "canonized as Saint Teresa of Calcutta" names the alias | Replaced with "canonized by the Catholic Church" |
| rmp-004 Hadith | **related** — shared Muhammad/Quran surface with bank "Islam" clue | Reframed around isnads (chains of transmitters) and Sharia primacy; removed explicit Muhammad/Quran names |
| rmp-005 Vedas | **related** — shared hinduism/sanskrit/upanishads with run's Samsara and bank's Hinduism/Karma | Reframed around oral transmission and śruti classification; removed "Hindu" and "Upanishads" from clue text |
| rmp-007 Frigg | **related** — shared norse mythology/odin surface with run's Fenrir | Reframed to lead with Baldr (her unique maternal role) rather than opening with the Odin relationship |
| rmp-008 William James | **leak** — "the novelist Henry James" contains the answer's surname "James" | Applied suggested fix: "his brother Henry was a celebrated American novelist" |
| rmp-009 Samsara | **related** — shared hinduism/vedas/upanishads surface with run's Vedas and bank's Karma/Hinduism | Reframed to "religious traditions of the Indian subcontinent" + "endless round of death and rebirth"; removed Vedas/Upanishads reference |
| rmp-010 Odysseus | **alias** — "was called Ulysses by the Romans" names the alias; **related** — shared homer/ithaca/trojan war with bank Odyssey/Iliad | Applied suggested clue: removed Roman-name clause; parentage + mêtis angle distinguishes from epic-title clues |
| rmp-011 Biblical Apocrypha | **alias** — "Catholics call these books deuterocanonical" names the alias | Applied suggested clue: describes Catholic/Orthodox practice without naming the alias term |
| rmp-012 Thomas Carlyle | **wording** — comma inside closing single quote | Moved comma outside: `'sage of Chelsea',` |
| rmp-013 Absurdism | **leak** — "'absurd' predicament" contains the answer stem; **wording** — comma inside closing quote | Applied suggested clue: removed 'absurd' entirely; fixed punctuation |
| rmp-014 Moksha | **related** — shared dharma/hinduism with bank Hinduism/Nirvana and run's Vedas | Reframed around the four Puruṣārthas, naming the other three as "wealth, pleasure, and moral duty" instead of artha/kama/dharma |
| rmp-015 Fenrir | **related** — shared norse mythology/odin surface with run's Frigg | Reframed to lead with the wolf's prophecy and its role at Ragnarök rather than Odin's leading the warriors |

#### wordplay-2026-07-11 (2 revised)

| ID | Issue | Fix |
|----|-------|-----|
| ini-01 Panama Canal | **related** — "Atlantic and Pacific oceans" shared with bank "Manifest Destiny" wordplay clue | Removed ocean names; reframed around the lock system and continental divide |
| ini-03 Trojan Horse | **related** — Trojan War scene shared with bank "Horse" anagram clue | Reframed through the computing security definition ("malicious software that disguises itself"), referencing the ancient stratagem as etymology |

#### Gate results (pass 2)

- `validate-wordplay.mjs` — ✓ 10/10 valid
- `import-to-supabase.mjs --dry-run` (music_performing_arts) — ✓ 15/15 pass, 0 bank collisions
- `import-to-supabase.mjs --dry-run` (religion_mythology_philosophy) — ✓ 15/15 pass, 0 bank collisions
- `import-to-supabase.mjs --dry-run` (wordplay-2026-07-11) — ✓ 10/10 pass, 0 bank collisions
