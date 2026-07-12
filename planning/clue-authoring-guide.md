# Clue Authoring Guide

Rules for writing trivia clues for this app (used by humans and by the weekly
draft-clues routine). Hard-won from real calibration feedback — follow them.

## Source-grounded, always

- Write a clue **only from facts stated in a cited source** (the Wikipedia lead
  extracts in `data/sourcing/docs/<category>/<slug>.json`, or the Wikidata fact
  store in `data/sourcing/facts/`). Do not write from memory.
- Attach the source as a citation on every clue: `citations: [{ source, title, url }]`.
- Run every authored pack through `tools/acquisition/verify-clue-sources.mjs`
  (Wikipedia/Wiktionary corroboration). `unverified` = the answer couldn't be
  cleanly sourced → fix or drop.

## Clue form (Jeopardy style)

- **Declarative, not interrogative.** Phrase as a statement with a "this/it"
  pointer: *"This river…"*, *"It is the only country that…"*. Never start with
  what/who/which/when/where/why/how unless the clue is genuinely declarative and
  contains a "this/these" pointer.
- **No answer leaks.** The clue must not contain the answer's words — and not
  just exact tokens. **Avoid any word sharing a stem or root with the answer**
  (e.g. "southernmost" gives away "Southern Ocean"; "Arabian" gives away
  "Arabia"; "Mexican" gives away "Mexico"). The `answer-stem-in-clue` check flags
  these, but author defensively.
- Keep clues ~12–28 words. Too short (<8 words) flags `thin-clue`.

## Difficulty (this is the part people get wrong)

Difficulty does **not** come from stacking more identifying facts — that makes a
clue *easier* (more ways in). It comes from revealing *less*:

**A clue's difficulty is set by its single most recognizable fact — the most
obvious path to the answer — and nothing else can raise it.** Every extra fact is
another path in, so more facts only make a clue *easier*, never harder. Difficulty
isn't something you *add*; it's a ceiling you find and lower — locate the most
obvious link and either cut it or make it as oblique as the value demands. (Cluing
*Tom Hanks*, you can pile on obscure films forever — but the instant "Forrest Gump"
appears it's a $200 clue, and nothing else pulls it back up.)

- **$200–$400 (recall):** a direct, well-known fact. *"It is the capital of Egypt."*
- **$600 (triangulation):** a couple of facts that narrow to a few candidates, or
  a moderately obscure single fact.
- **$800–$1000 (hard):** a **single, oblique, often counterintuitive hook** with
  the obvious anchor hidden, and asked from the *surprising* end. Strip all
  helper context. Examples:
  - *"France's longest land border is with this country."* → **Brazil** (about
    France; answer is the surprising Brazil; no "European" crutch).
  - *"It is the only country that borders both Germany and Russia."* → **Poland**
    (don't add "thanks to Kaliningrad" — that telegraphs and can mislead).

When in doubt, write the leanest possible clue and let the solver find the "aha".

## Uniqueness (for combinatorial/oblique clues)

A clever constraint clue is valid only if it resolves to **exactly one** answer.
Verify with `tools/acquisition/verify-clue-uniqueness.mjs` against the fact store.
Note the data caveats it surfaced: Wikidata `P47` border *counts* include maritime
borders (unreliable — use border *membership*); population figures can be stale
(avoid "most populous" superlatives); area/landlocked/continent are reliable.

## Pack format + valid subcategories

Author a normalized pack (see `data/sourcing/packs/*.json` for the shape). Each
question needs a `category_id` and a `subcategory_name` that **exactly matches**
an entry in `data/sourcing/subcategories.json` (the importer rejects unknown
subcategories).

## Workflow

```
author pack → verify-clue-sources.mjs --pack <pack> --write-back
            → import-to-supabase.mjs <pack> --dry-run   (quality + difficulty gate)
            → human review → import live
```

Build-then-swap when rebuilding a whole category: import the new sourced clues,
then `retire-old-category-clues.mjs --category <c>` to deactivate the old ones.
