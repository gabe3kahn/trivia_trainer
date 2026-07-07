## Run summary — 2026-07-07

Scheduled draft-clues run. All non-geography categories had open draft PRs; PR #106 covered both selected categories, so all ~30 answers from that PR were excluded.

---

### Pack 1 — `religion_mythology_philosophy` (15 clues)

**Selection rationale:** 59 active questions (thinnest non-geography category). Roman & Norse Mythology was the emptiest subcategory (4 active). $200 tier was also under-weight (7 active vs avg 11.8).

**Value distribution:** $200×3, $400×4, $600×4, $800×2, $1000×2

**Clue highlights:**
- `$200` Hermes, Diwali, Adam — filling the $200 gap
- `$400` Freyja (Brísingamen + Fólkvangr detail), Talmud (Mishnah/Gemara structure), Valhalla, Confucius
- `$600` Ragnarök, Empiricism, Ganesha (elephant head + Jain/Buddhist reach), Zoroastrianism (Zarathushtra/Ahura Mazda)
- `$800` Janus (two-faced deity, month naming, oblique), Epictetus (born into slavery in Phrygia)
- `$1000` Eris (golden apple at the divine wedding → Judgement of Paris), Mithraism (Roman mystery religion, Iranian Zoroastrian inspiration — no "Mithra-" stem in clue)

**Collision resolved:** Jupiter was already active (sci-draft-2026-06-20-001, the planet) → swapped to Hermes.

**All 15 verified** by `verify-clue-sources.mjs --write-back` (100%, no weak). Dry-run clean.

---

### Pack 2 — `pop_culture_media_modern_life` (15 clues)

**Selection rationale:** 64 active questions (second-thinnest non-geography). $1000 tier severely under-weight (2 active vs avg 12.8). Thin subcategories: Comics & Graphic Novels (2 active), Fashion & Lifestyle (1 active).

**Value distribution:** $200×1, $400×4, $600×5, $800×2, $1000×3

**Clue highlights:**
- `$200` Mary Poppins (Julie Andrews feature debut angle)
- `$400` Bridgerton (Shondaland's first Netflix scripted show, alternative-history angle), Planes/Trains/Automobiles, TikTok (3 sec–60 min range), Dirt Devil (Techtronic/Oreck/Hoover parent company)
- `$600` Clerks ($27,575 budget before Miramax), YouTube (Valentine's Day 2005 / PayPal founders), Chanel No. 5 (Coco + Ernest Beaux, numeral not name), Ben-Hur (largest budget + sets at time), Will Smith (DJ Jazzy Jeff hip hop career)
- `$800` Maus (first graphic novel Pulitzer, 1992), Halloween (Celtic/Samhain vs. Christian origins scholarly debate)
- `$1000` As Good as It Gets (most recent film to sweep both lead acting Oscars), Watchmen (Charlton Comics origin → original characters), Mindy Kaling (born Vera Mindy Chokalingam, Tony Award)

**Collisions resolved (6 swaps):** Bridget Jones, Labubu, Stop Making Sense, Moulin Rouge!, Gene Simmons, Neil Simon → Bridgerton, Planes/Trains, Clerks, Ariana Grande (collision) → Blazing Saddles (collision) → Halloween.

**All 15 verified** (100%, no weak). Dry-run clean.

---

### Pack 3 — `wordplay-2026-07-07` (10 clues)

**Mechanics selected:** `rhyme_time` + `initials` — only two mechanics not already in an open draft PR (#107 anagram, #109 before_after, #112 homophone, #113 hidden_word, #114 crossword).

**Rhyme Time (5):** Real Deal ($200), Big Gig ($400), Night Flight ($600), Spring Fling ($600), Deep Sleep ($800)

**Initials (5):** Bruce Banner B.B. ($400), Double Jeopardy D.J. ($600), Golden Ratio G.R. ($600), Invisible Hand I.H. ($800), Pyrrhic Victory P.V. ($800)

Dry-run clean (10/10).

---

---

## Editorial critic

Revise pass applied critic feedback across all three packs (14 total changes):

**pop_culture_media_modern_life** (5 revises):
- `pcm-2026-07-07-004` TikTok — removed "Tik Tok" alias (collides with Kesha single)
- `pcm-2026-07-07-007` YouTube — repriced $600 → $400 (household-name, standard trivia fact)
- `pcm-2026-07-07-010` Will Smith — removed bare "Smith" alias (too ambiguous across many referents)
- `pcm-2026-07-07-011` Maus — replaced "mice" with "rodents" to eliminate Germanic root leak (*mūs*)
- `pcm-2026-07-07-015` Mindy Kaling — rewrote to Kelly Kapoor / The Office / Never Have I Ever angle; birth-name hook leaked both "Mindy" and "Kaling"

**religion_mythology_philosophy** (7 revises):
- `rmp-2026-07-07-002` Diwali — added `allow_duplicate: true`; Diwali (festival), Hinduism (bank, the religion), and Ganesha (deity) are distinct facts sharing topical overlap only
- `rmp-2026-07-07-004` Freyja — rewrote to focus on Brísingamen necklace, cats chariot, and seiðr sorcery; removed the "receives half of warriors slain in battle" passage that overlapped with Valhalla
- `rmp-2026-07-07-007` Valhalla — rewrote to remove "final cosmic battle" reference that overlapped with Ragnarök; now focuses on feasting/combat-skills afterlife
- `rmp-2026-07-07-008` Ragnarök — added `allow_duplicate: true`; after Valhalla rewrite, remaining overlap (Odin + Norse mythology) is unavoidable topical, not same-fact
- `rmp-2026-07-07-010` Ganesha — repriced $600 → $400 (elephant-head hook is unambiguous); added `allow_duplicate: true` (distinct deity from Diwali festival and Hinduism bank entry)
- `rmp-2026-07-07-011` Zoroastrianism — used critic's suggested clue; removed "Ahura Mazda" which leaked the "Mazda" root of alias "Mazdayasna"
- `rmp-2026-07-07-014` Eris — replaced explicit "Hera, Athena, and Aphrodite" with "three-way rivalry among the Olympians" to reduce entity overlap with active bank clues for Athena and Aphrodite

**wordplay** (2 revises + 1 validator-caught fix):
- `wp-2026-07-07-ini-01` Bruce Banner — replaced "hulking" with "towering" to eliminate *hulk* root leak
- `wp-2026-07-07-rt-05` Deep Sleep — repriced $800 → $600 (plain-synonym clue, single transparent hook)
- `wp-2026-07-07-ini-03` Golden Ratio — removed aliases "Golden Mean" (G.M.) and "Golden Section" (G.S.) whose initials didn't match the shown hint G.R.; caught by `validate-wordplay.mjs` (critic gave a pass, gate did not)

**No critic overrides.** All verdicts accepted.

All three packs cleared `import-to-supabase.mjs --dry-run` and `validate-wordplay.mjs` after revisions.
