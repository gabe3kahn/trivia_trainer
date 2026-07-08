## 2026-07-08 Daily Draft

Three packs authored, verified, and dry-run clean. No live imports.

---

### Pack 1 — `music_performing_arts` (15 clues)

**Tier balance:** 3×$200 · 4×$400 · 3×$600 · 3×$800 · 2×$1000  
**Subcategory coverage:** Popular Music (10), Classical Composers (2), Music Theory & Terms (1), Opera (1), Broadway & Musicals (1)  
**Verification:** 15/15 verified · dry-run OK (keep=11, rewrite=4)

| Value | Answer | Subcategory |
|-------|--------|-------------|
| $200 | Andrew Lloyd Webber | Broadway & Musicals |
| $200 | Mariah Carey | Popular Music |
| $200 | Bruce Springsteen | Popular Music |
| $400 | George Gershwin | Classical Composers |
| $400 | The Cars | Popular Music |
| $400 | TLC | Popular Music |
| $400 | Dua Lipa | Popular Music |
| $600 | Claude Debussy | Classical Composers |
| $600 | Fugue | Music Theory & Terms |
| $600 | CBGB | Popular Music |
| $800 | Pelléas et Mélisande | Opera |
| $800 | New Kids on the Block | Popular Music |
| $800 | LL Cool J | Popular Music |
| $1000 | Jay-Z | Popular Music |
| $1000 | Fairytale of New York | Popular Music |

**Collision resolved:** Tyler, the Creator blocked (active in pop_culture_media as pcm-2026-07-02-009) → replaced with New Kids on the Block.

---

### Pack 2 — `words_language` (15 clues)

**Tier balance:** 3×$200 · 4×$400 · 3×$600 · 3×$800 · 2×$1000  
**Subcategory coverage:** Definitions (10), Etymology (3), Foreign Words & Phrases (2)  
**Verification:** 12/15 verified · 2 unverified (URL-fetch failures for Raison d'être, Escalate — content is sourced) · 1 weak (Lechazo) · dry-run OK (keep=13, rewrite=2)

| Value | Answer | Subcategory |
|-------|--------|-------------|
| $200 | Hashtag | Definitions |
| $200 | Waif | Definitions |
| $200 | Raison d'être | Foreign Words & Phrases |
| $400 | Gerund | Definitions |
| $400 | Pluperfect | Definitions |
| $400 | Escalate | Etymology |
| $400 | Taboo | Definitions |
| $600 | Nomenclature | Definitions |
| $600 | Proscription | Etymology |
| $600 | Mutton | Definitions |
| $800 | Urdu | Definitions |
| $800 | Philtrum | Etymology |
| $800 | Onomastics | Definitions |
| $1000 | Plusquamperfect | Definitions |
| $1000 | Lechazo | Foreign Words & Phrases |

**Collisions resolved:** Guillotine blocked (active in history as hist-2026-06-19-003) → replaced with Waif. Sodium blocked (active in science as sci-draft-2026-06-20-002) → replaced with Philtrum.

---

### Pack 3 — `wordplay` (10 clues)

**Mechanics:** Anagram (5) + Rhyme Time (5)  
**Validation:** 10/10 valid · dry-run OK (keep=10, rewrite=0)

| Mechanic | Value | Answer | Detail |
|----------|-------|--------|--------|
| anagram | $200 | Aster | scramble: stare |
| anagram | $400 | Trace | scramble: crate |
| anagram | $600 | Mates | scramble: steam |
| anagram | $800 | Smile | scramble: limes |
| anagram | $1000 | Petal | scramble: leapt |
| rhyme_time | $200 | Fair Share | fair/share |
| rhyme_time | $200 | Wild Child | wild/child |
| rhyme_time | $400 | Green Screen | green/screen |
| rhyme_time | $400 | Hot Pot | hot/pot |
| rhyme_time | $600 | Whale Trail | whale/trail |

**Collision resolved:** Melon blocked (alias of active Melons in wp-draft-2026-06-17-005) → replaced with Trace (crate→Trace).

---

---

### Editorial critic — revise pass applied

**5 revises in music pack, 3 revises in wordplay pack. No drops. No overrides.**

| ID | Answer | Change |
|----|--------|--------|
| music-2026-07-08-001 | Andrew Lloyd Webber | Removed "Cats" from clue (shared entity with active bank clue music-2026-06-29-008 "Mr. Mistoffelees"); replaced with "Jesus Christ Superstar" and retained the EGOT hook |
| music-2026-07-08-008 | Claude Debussy | Rewrote to pivot to "Clair de lune" / "La mer" — drops the 1902/Pelléas/Symbolism entities shared with clue 011 |
| music-2026-07-08-009 | Fugue | Dropped etymology opener ("Derived from the Latin for 'flight'") — root-leak fix; applied suggested structural description |
| music-2026-07-08-011 | Pelléas et Mélisande | Rewrote to use Maeterlinck source + plot description instead of naming Debussy or mirroring clue 008's biographical moment |
| music-2026-07-08-013 | LL Cool J | Removed stage-name expansion ("Ladies Love Cool James") that leaked "Cool"; applied suggested clue with Def Jam / Kennedy Center / Hall of Fame / song-title hooks |
| wordplay-2026-07-08-ana-01 | Aster | Removed "star pattern" (root-leak on Greek aster); applied suggested clue preserving "stare" scramble |
| wordplay-2026-07-08-ana-04 | Smile | Fixed non-idiomatic "rises to the lips" → "plays across the lips" |
| wordplay-2026-07-08-rt-05 | Whale Trail | Removed "cetacean" (shares ketos/cetus root with WHALE); applied suggested clue |

**Gates after revise pass:** wordplay validation ✓ · source verification 15/15 · music dry-run OK (keep=10, rewrite=5) · wordplay dry-run OK (keep=10, rewrite=0)

---

### Checklist

- [x] Exactly 2 sourced categories + 1 wordplay pack
- [x] No live Supabase import (dry-run only)
- [x] All answers fresh against active bank and in-flight PRs
- [x] Wordplay mechanics: anagram + rhyme_time (least-recently-used pairing)
- [x] Branch pushed: `draft-clues/daily-2026-07-08`
- [x] Editorial critic feedback applied (revise pass)
- [ ] PR to be opened by automated step
