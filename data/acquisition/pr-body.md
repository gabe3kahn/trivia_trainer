## Draft run — 2026-07-06

**Categories drafted:** `arts_visual_culture` (83 active → target), `science` (85 active → target)
**Wordplay mechanics:** anagram + crossword (crossword was least-recently used)

---

### arts_visual_culture — 15 clues

| Value | Answer | Subcategory | Note |
|-------|--------|-------------|------|
| $200 | Mosaic | Art Terms & Techniques | |
| $400 | Museo del Prado | Museums & Collections | |
| $400 | Neuschwanstein | Architecture | |
| $400 | Claude Monet | Famous Artworks | visual — Haystacks series |
| $600 | Mary Cassatt | Painters & Sculptors | |
| $600 | The School of Athens | Famous Artworks | visual — Raphael fresco |
| $600 | Magnum opus | Art Terms & Techniques | |
| $600 | Pablo Picasso | Painters & Sculptors | |
| $600 | Hearst Castle | Architecture | |
| $800 | Peggy Guggenheim | Patrons, Critics & Schools | |
| $800 | Mathew Brady | Photography | |
| $800 | Centre Pompidou | Museums & Collections | |
| $800 | Caravaggio | Famous Artworks | visual — Judith Beheading Holofernes |
| $1000 | Panthéon | Architecture | first interment = Honoré Gabriel Riqueti |
| $1000 | Gertrude Stein | Patrons, Critics & Schools | 1933 memoir in companion's voice |

Bank collisions resolved: Ansel Adams → Dorothea Lange → Henri Cartier-Bresson → Van Gogh → **Magnum opus** (all photography options were active; switched to Art Terms subcategory).

---

### science — 15 clues

| Value | Answer | Subcategory | Note |
|-------|--------|-------------|------|
| $200 | Natural selection | Biology | |
| $400 | Carbon dioxide | Chemistry | |
| $400 | Nebula | Astronomy & Space | |
| $400 | Mycology | Biology | |
| $400 | Myopia | Medicine & Anatomy | |
| $400 | Gout | Medicine & Anatomy | |
| $600 | Scapula | Medicine & Anatomy | |
| $600 | Nicotine | Chemistry | |
| $600 | Redshift | Astronomy & Space | |
| $600 | Homeostasis | Biology | |
| $800 | Alexander Graham Bell | Inventions & Discoveries | |
| $800 | Philtrum | Medicine & Anatomy | "love charm" etymology |
| $800 | Guanine | Chemistry | base pairs with cytosine |
| $1000 | Big Crunch | Astronomy & Space | |
| $1000 | ENIAC | Inventions & Discoveries | designed for artillery firing tables |

Bank collisions resolved: Quarantine/Clavicle/Somnambulism/Logorrhea (wl packs) + Electromagnetic spectrum/Absolute zero/Isaac Newton/Entropy/Uranus/Aristotle (yesterday's science pack + deck-001) → Carbon dioxide, Myopia, Alexander Graham Bell, ENIAC.

---

### wordplay — 10 clues

**Anagrams (5):** dream→Armed, baste→Beast, petal→Plate, colt→Clot, acres→Scare

**Crosswords (5):** Grove `_R___`, Knack `K____`, Epoch `__O__`, Waltz `____Z`, Elegy `____Y`

---

All three packs passed `verify-clue-sources --write-back` (15/15 verified each) and `import-to-supabase --dry-run` with zero deactivations.

Wordplay calibration advisory: `$400→$600=3, $600→$800=1` (difficulty bumps suggested but not blocking).

---

## Editorial critic

**13 revised, 0 dropped-and-replaced, 2 overrides.**

### Revisions applied

**arts_visual_culture (3):**
- `arts-vc-002` Museo del Prado — rewrote clue to remove shared Madrid/Spain keywords overlapping with Las Meninas, El Escorial, El Greco bank entries; now focuses on neoclassical building, century range, and collection breadth.
- `arts-vc-003` Neuschwanstein — corrected factual error: "world's tallest" → "world's tallest **castle**" (the Guinness record is specific to castles, not structures generally).
- `arts-vc-008` Pablo Picasso — rewrote to remove cubism/Guernica/Georges Braque references that overlapped with the active "Guernica" bank clue; now angles through Blue Period, Rose Period, and Madoura ceramics.

**science (5):**
- `sci-001` Natural selection — rewrote to remove Charles Darwin, evolution, and "Origin of Species" references that overlapped with active Galápagos Islands and Charles Darwin bank clues.
- `sci-002` Carbon dioxide — removed "With formula CO2," which put the alias CO2 verbatim in the clue (hard alias-in-clue block).
- `sci-003` Nebula — removed "ionized" from "consisting of ionized gas"; nebulae can be ionized, neutral, or molecular — the original claim was factually incorrect.
- `sci-009` Redshift — rewrote to pivot from wavelength/frequency physics (shared with active Doppler effect bank clue) to Hubble's 1920s cosmological observations.
- `sci-011` Alexander Graham Bell — value $800 → $400 (two unambiguous direct hooks make it recall-level); removed over-broad alias "Bell."

**wordplay (5):**
- `wordplay-ana-03` Plate — changed "vessel" to "charger" (a plate is not a vessel; the word steered solvers toward a cup or bowl).
- `wordplay-cwd-02` Knack — rewrote crossword clue to be vaguer ("Something you either have or you don't"), so the K____ pattern does genuine disambiguating work; also removes "skill" keyword overlapping with active "Neat Feat" rhyme-time clue.
- `wordplay-cwd-03` Epoch — rewrote to avoid "history/geology" keywords shared with active "Era" bank clue.
- `wordplay-cwd-04` Waltz — value $600 → $400 (WALTZ + "ballroom dance in three-quarter time" is a single household fact).
- `wordplay-cwd-05` Elegy — rewrote to remove "mourning the dead" wording that shared death/funeral/mourning entities with active "Mourning" bank clue.

### Overrides (critique not applied)

- `arts-vc-004` Claude Monet (visual, $400) — **override**: the bank entry flagged is answer "Impression, Sunrise" (the *painting*), while this clue asks for the *artist* shown in a different work (Haystacks). Genuinely distinct answers; no revision needed.
- `arts-vc-013` Caravaggio (visual, $800) — **override**: bank entries answer "Baroque" (style) and "Chiaroscuro" (technique), not the artist. A visual clue showing this painting cannot further differentiate; answers are genuinely distinct.

### Gate results after revisions

- `validate-wordplay.mjs`: ✓ 10/10 valid
- `import-to-supabase --dry-run` arts: OK (keep=14, rewrite=1 advisory)
- `import-to-supabase --dry-run` science: OK (keep=12, rewrite=3 advisory)
- `import-to-supabase --dry-run` wordplay: OK (keep=10, rewrite=0)
