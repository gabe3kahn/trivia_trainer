# Edit lessons — what human review keeps changing

Distilled from `data/acquisition/clue-edits.md` (run `mine-clue-edits.mjs` to refresh
the raw signal). These are the patterns reviewers apply over and over; **the drafter
should pre-apply them so they stop coming up.** Cross-category — value, categorization,
craft, leaks — plus wordplay style at the end.

> Maintenance: after a batch of PRs, re-run the miner and fold new recurring patterns
> in here (human-approved). Keep it tight — it's injected into the drafter's context.

## 1. Difficulty calibration (the most-edited thing — 54 value changes)
- **Naming the answer's famous works/achievements, or a household fact, = $200–$400 recall, not $600+.** Reviewers lowered: Colosseum, Sistine Chapel, Berlin Wall → $200; The Odyssey, 1984, The Hobbit → $200; Don Quixote, Moby-Dick → $400; Mark Twain (when it named *Tom Sawyer / Huckleberry Finn*) → $200. (2026-06-19: Queen Victoria "longest reign / Empress of India" → $200, Theodore Roosevelt "youngest president, succeeded the assassinated McKinley" → $400, Garfield → $200, Spotify → $400 — all household answers given via their famous defining fact; the drafter had them at $600–$800.) If a casual fan instantly knows it, it's cheap.
- **Earn $600–$1000 by withholding the obvious** — a single oblique/specialist hook, not a pile of famous facts. Reviewers raised: Mahler, Bayreuth, Boléro (specialist classical) → $600–$800; Battle of Ayacucho → $1000; Mark Twain *rewritten* to the Halley's-Comet hook with no book titles → $800; taiga, Enzymes → $600.
- Rule of thumb: **$200** = household name stated plainly · **$400** = one solid fact · **$600** = needs triangulation · **$800–$1000** = one oblique/counterintuitive hook, obvious anchors hidden.
- **$800–$1000 needs a genuinely DEEPER cut, not just an oblique angle on a household name** (oblique-on-marquee caps around $600 — cluing Apollo via "plague + the kouros ideal" is still only ~$600). Two routes to the top tier, both good: **(a) an obscure entry point to a famous answer** — *"Zeus's daughter, born after he took the form of a swan"* → Helen of Troy; or **(b) genuinely deep subject matter / a lesser-known answer** — *"the Greek goddess of the Moon"* → Selene; *"the Titaness of memory, mother of the nine Muses"* → Mnemosyne; Epicurus clued on ataraxia; Medusa as the only *mortal* Gorgon. **Each category pack needs its OWN hard tail — at least one $800 AND one genuine $1000 in EVERY pack, never borrowed from the sibling category drafted the same run.** (2026-06-19: both $1000s landed in history while pop culture topped out at $800 — don't let one category carry the other's depth.) Aim for roughly 3 of every ~12 clues at $800+. That depth usually means sourcing beyond the marquee topics — reach for a lesser-known figure or a specialist sub-fact, not the front-page name.
- **Span the range — keep a deliberate value MIX.** Easy $200–$400 clues are good and welcome; just don't bunch everything at one value. A strong set runs from a couple of accessible clues up through a genuine $1000.
- **To make a clue harder, REMOVE an identifying detail — don't add more.** Reviewers repeatedly asked exactly this: *John Adams* — "make it more challenging by removing 'second president' or even '1800'"; *Mark Twain* — drop the book titles. When a clue is comfortably gettable, cut a date/ordinal/name rather than pile on facts.
- **At higher values, a geographic or contextual tell that half-names the answer is too revealing.** *Warsaw Uprising* — "for 600, 'capital of Poland' is too revealing"; *Solidarity* — "just say 'Poland'." Scan $600+ clues for a phrase that points straight at the answer and cut it.

## 2. Categorize by SUBJECT, not by surface angle (8 re-homes)
A clue's category is its **answer's subject/type**, never an incidental framing:
- A **person** → their field: Annie Oakley → history/Historical Figures; Shaggy (musician) → music/Popular Music.
- A **film** → Film (not "Film Scores" unless the clue is actually about the music): The Big Lebowski → pop-culture/Film.
- A **place/city** → geography: New Orleans → geography/U.S. States & Cities.
- A **toy** → sports_games_leisure/Toys & Games (Mr. Potato Head, Easy-Bake Oven, Labubu).
- A **technology/invention** → science/Inventions & Discoveries (E-ZPass).
- A **definition/etymology/foreign phrase** → words_language, **never** filed by the linguistic angle.

## 3. Clue craft — trim, then lead with the hook (79 rewordings)
- **Cut tangential biography/context.** *Michelangelo:* "born in the Republic of Florence but spent most of his career in Rome" → "He sculpted the marble 'David' and the 'Pietà,' and painted the Sistine Chapel ceiling." Vivid, identifying detail beats encyclopedic setup.
- **Tighten.** *John Adams:* drop "permanent home / newly completed" filler. *The Odyssey:* drop the Penelope subplot — one clean sentence.
- **Cut the trailing ";…" clause.** Reviewers repeatedly lop off the second half after a semicolon — it's usually padding (*Kentucky Derby:* dropped the "colts carry 126 lb…" weights; *Backgammon:* dropped "with dice and 15 counters per side" at $600) or a leak (a "BBA vs. NBA" near-acronym tail). If a clue has a `;`, ask whether the part after it earns its place.
- **Don't telegraph with redundant geography.** *Warsaw Uprising:* "in the capital of Poland" was cut (it half-named the answer); *Solidarity:* "in a communist country" → "Polish."
- **For famous/iconic subjects, clue an oblique or surprising detail — not the textbook attribute.** Reviewers flagged mythology clues as too easy and uncreative: don't clue *Odin* as "the one-eyed Norse king of the gods" — clue his ravens Huginn and Muninn, or that he hung nine nights on Yggdrasil to win the runes. Leading with the obvious makes a would-be $600 answer play like $200. Pick the angle a casual fan *wouldn't* immediately expect. (And when a figure spans traditions, name which — "Greek" vs "Roman" — so Zeus/Jupiter isn't ambiguous.)

## 4. Leaks & alias hygiene (recurring)
- **Never put a synonym of the answer in the clue.** "Also called mother-of-pearl" → *nacre* and "Also called the boreal forest" → *taiga* both got reworded out. Scan every clue for a word that *is* the answer by another name.
- **Person answers: add the surname as an alias** (van Gogh, Botticelli, Whistler). For visual "Name the artist," the alias is the surname; for "Name the painting," title aliases.
- **Don't alias the synonym you used as a hint** (boreal forest was removed as a taiga alias).
- **Match the clue's specificity to the exact answer, and sanity-check the grader.** Reviewers flagged: a clue that points to "Shogunate" shouldn't have answer "Tokugawa Shogunate" (clue and answer must agree on specificity); and "would the grader accept (or wrongly accept) a shorter form?" — e.g. *New Spain* vs bare "Spain." Pick the answer the clue actually pins down, and add aliases for legitimate equivalents without opening an ambiguous short answer.

## 5. One clue per answer/work (15 drops)
- The dedupe gate now blocks identical answers, but also avoid **"effectively a repeat"**: don't clue both a work and its central character/creator (Jay Gatsby was dropped in favor of The Great Gatsby). Pick the better single clue.
- **Dedupe across the whole day's batch, not just within one pack.** A clue gets cut as "already a question/answer" when a sibling pack drafted the same day covers it — *FIFA World Cup* was dropped because the sports pack already had the Brazil/World-Cup clue; *Grand Slam* duplicated the existing tennis question. Before adding an answer, scan the other packs in the same run and the active bank.

## 6. Wordplay style (constructed clues)
Each daily wordplay pack uses **exactly two** of the four mechanics (5 clues each); **rotate which two across runs** so anagrams + Before & After aren't the only thing that ever ships. `validate-wordplay.mjs` is the correctness gate.
- **Anagrams — the format reviewers keep fixing:**
  - **NO fill-in-the-blank.** A clue like *"…knows when to stay completely ___"* telegraphs the answer (and the scramble word sits right beside the blank). Write a **natural sentence whose meaning the answer completes**, with the scramble word woven in elsewhere — the solver must spot which ordinary word to rearrange. Good: *"Don't leave your arm dangling below the table — just bend the hinge joint to wave hello"* → elbow (scramble "below").
  - **Never call the word out** — no bold, CAPS, italics, underline, or quotes. `constraint_text`: "Rearrange the letters of one word in this clue to find the answer" — it must not point at the word.
  - **Fresh, non-trivial pairs.** Don't reuse a pair already in any `wordplay-*.json` (silent/listen, night/thing were reused — check first). Avoid **near-synonym** pairs (angered/enraged, alerting/triangle that just sound clever) — they're too easy; the answer should be a genuine surprise, not a restatement.
- **Before & After:** one narrative cluing both halves **without naming either**, pitched between two failure modes reviewers flag. **Too pointed** = the wording near-states a half (*"a summer scoop of frozen dairy dessert meets the spreadable dairy topping"* → reworded to *"…finds itself spread upon a New York sesame specialty"* for Ice Cream Cheese). **Too obtuse** = the wording is so oblique it's unparseable (*Trolley Problem Child* was called "too obtuse," rewritten to *"A bratty imp faces an ethical dilemma aboard a small train"*). Aim for an evocative scene that *implies* each half. Good: *"An uninvited wedding guest crosses San Francisco's iconic suspension bridge on her way to the ceremony"* → Golden Gate Crasher.
- **Homophones:** the answer sounds like a differently-spelled word the clue plays on (knight ↔ night). Confirm they truly sound alike — the validator can't.
- **Hidden words:** the answer hides as consecutive letters inside a longer phrase in the clue ("cat" in "location") — never visually marked.
- Keep the answer's own words out of the clue (the leak guard enforces it).
