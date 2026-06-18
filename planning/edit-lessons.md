# Edit lessons — what human review keeps changing

Distilled from `data/acquisition/clue-edits.md` (run `mine-clue-edits.mjs` to refresh
the raw signal). These are the patterns reviewers apply over and over; **the drafter
should pre-apply them so they stop coming up.** Cross-category — value, categorization,
craft, leaks — plus wordplay style at the end.

> Maintenance: after a batch of PRs, re-run the miner and fold new recurring patterns
> in here (human-approved). Keep it tight — it's injected into the drafter's context.

## 1. Difficulty calibration (the most-edited thing — 29 value changes)
- **Naming the answer's famous works/achievements, or a household fact, = $200–$400 recall, not $600+.** Reviewers lowered: Colosseum, Sistine Chapel, Berlin Wall → $200; The Odyssey, 1984, The Hobbit → $200; Don Quixote, Moby-Dick → $400; Mark Twain (when it named *Tom Sawyer / Huckleberry Finn*) → $200. If a casual fan instantly knows it, it's cheap.
- **Earn $600–$1000 by withholding the obvious** — a single oblique/specialist hook, not a pile of famous facts. Reviewers raised: Mahler, Bayreuth, Boléro (specialist classical) → $600–$800; Battle of Ayacucho → $1000; Mark Twain *rewritten* to the Halley's-Comet hook with no book titles → $800; taiga, Enzymes → $600.
- Rule of thumb: **$200** = household name stated plainly · **$400** = one solid fact · **$600** = needs triangulation · **$800–$1000** = one oblique/counterintuitive hook, obvious anchors hidden.

## 2. Categorize by SUBJECT, not by surface angle (8 re-homes)
A clue's category is its **answer's subject/type**, never an incidental framing:
- A **person** → their field: Annie Oakley → history/Historical Figures; Shaggy (musician) → music/Popular Music.
- A **film** → Film (not "Film Scores" unless the clue is actually about the music): The Big Lebowski → pop-culture/Film.
- A **place/city** → geography: New Orleans → geography/U.S. States & Cities.
- A **toy** → sports_games_leisure/Toys & Games (Mr. Potato Head, Easy-Bake Oven, Labubu).
- A **technology/invention** → science/Inventions & Discoveries (E-ZPass).
- A **definition/etymology/foreign phrase** → words_language, **never** filed by the linguistic angle.

## 3. Clue craft — trim, then lead with the hook (20 rewordings)
- **Cut tangential biography/context.** *Michelangelo:* "born in the Republic of Florence but spent most of his career in Rome" → "He sculpted the marble 'David' and the 'Pietà,' and painted the Sistine Chapel ceiling." Vivid, identifying detail beats encyclopedic setup.
- **Tighten.** *John Adams:* drop "permanent home / newly completed" filler. *The Odyssey:* drop the Penelope subplot — one clean sentence.
- **Don't telegraph with redundant geography.** *Warsaw Uprising:* "in the capital of Poland" was cut (it half-named the answer); *Solidarity:* "in a communist country" → "Polish."

## 4. Leaks & alias hygiene (recurring)
- **Never put a synonym of the answer in the clue.** "Also called mother-of-pearl" → *nacre* and "Also called the boreal forest" → *taiga* both got reworded out. Scan every clue for a word that *is* the answer by another name.
- **Person answers: add the surname as an alias** (van Gogh, Botticelli, Whistler). For visual "Name the artist," the alias is the surname; for "Name the painting," title aliases.
- **Don't alias the synonym you used as a hint** (boreal forest was removed as a taiga alias).

## 5. One clue per answer/work (8 drops)
- The dedupe gate now blocks identical answers, but also avoid **"effectively a repeat"**: don't clue both a work and its central character/creator (Jay Gatsby was dropped in favor of The Great Gatsby). Pick the better single clue.

## 6. Wordplay style (constructed clues)
- **Anagrams:** weave the scramble word into a witty, natural sentence **in normal case** (not CAPS — capitalizing gives it away on a non-timed clue), with the answer fitting the sentence's meaning. *"The meek will inherit the earth, not the faint of this"* → **heart**. The solver must spot which word to rearrange.
- **Before & After:** one narrative that clues both halves **without naming either**. *"The boxer who floated like a butterfly says 'open sesame' before stinging like a bee"* → **Muhammad Ali Baba**.
- Keep the answer's own words out of the clue (the leak guard enforces it).
