# Wordplay generator (separate from the daily drafter)

**Status:** planned, not built. Lands after the Compete/FE work.

## Why it's separate
Real wordplay can't be *sourced* from a Wikipedia extract — it's **constructed**. When the daily drafter (which is told to write only from cited docs) was pointed at `language_wordplay`, it produced vocabulary/definition recall clues filed under "Definitions/Etymology," in the wrong subject categories and often leaking their own answers (e.g. "Also called mother-of-pearl" → *nacre*). So the daily drafter now **skips `language_wordplay`** entirely (see `draft-clues-prompt.md`), and wordplay gets its own builder.

## What it generates
Clues in `category_id = language_wordplay`, `mechanic` per type, that exercise a *word skill*, not subject recall:

- **Anagram** — "Rearrange CRATE into a piece of furniture" → CARTER… (target is a real word/name; the letters are the clue).
- **Before & After** — two terms sharing a pivot word: "Boxing legend + Baba's cave password" → MUHAMMAD ALI + ALI BABA → "MUHAMMAD ALI BABA".
- **Hidden word** — answer concealed in a phrase: "There's a tree in foREST Areas" → REST? (define precisely at build time).
- **Homophones / soundalikes** — "Sounds like a number but means a writing instrument."
- **Starts-with / ends-with / contains** — letter-pattern constraints.
- **Rhyme / word ladder** — chains and rhyming pairs.

These are the subcategories already in `subcategories.json` under `language_wordplay` (Anagrams, Before & After, Definitions, Homophones & Soundalikes, Puns, Quotes & Idioms, Rhymes & Word Ladders, Etymology, Foreign Words & Phrases, Initials & Abbreviations, Grammar & Usage) — the builder targets the *constructed* ones; pure recall ones (Definitions/Etymology/Foreign Words) should be re-homed to their real subject instead.

## How it's built (construction, then validation)
1. **Generate candidates** from a word list / lexicon (not Wikipedia):
   - Anagrams: index a dictionary by sorted-letters; pick targets with exactly one (or one *interesting*) anagram so the answer is unique.
   - Before & After: find a pivot word W such that `A + W` and `W + B` are both well-known multi-word terms; splice.
   - Hidden word: scan/generate carrier phrases that span the target.
2. **Validate / uniqueness** (the wordplay analogue of `verify-clue-uniqueness.mjs`): the constructed clue must resolve to exactly one intended answer. Reject anagrams with multiple common solutions; reject hidden-word clues where another word also hides in the carrier; confirm Before & After halves are real, recognizable terms.
3. **No answer leak** by construction (reuse the stem-leak check), and **distinct answers** within a pack (the import dedupe gate already enforces this).
4. **Difficulty (1–5):** by obscurity of the target word + length/complexity of the transform (a 5-letter single-anagram = easy; a 9-letter multi-step = hard).
5. **Human review:** emit a pack to `data/sourcing/packs/drafts/`, run the dry-run gate, open a PR — same review flow as the daily drafter. Wordplay clues carry no `citations`/`verification_status` (nothing to corroborate); the gate should treat `mechanic`-constructed clues as `skipped` for source-verification (the verifier already skips constructed wordplay).

## Open questions
- **Lexicon source:** bundle a word-frequency list (e.g. a public-domain frequency list) so "is this a real, common word/term?" checks run offline.
- **Cadence:** on-demand batches vs a scheduled job. Likely on-demand (it doesn't need fresh source data the way the daily harvest does).
- **Coverage target:** how many wordplay clues do we actually want? Wordplay is a *mode* (the Train "Wordplay" mode), so a few dozen good ones across mechanics may be plenty.
