/**
 * Build a CONSTRUCTED wordplay pack (anagrams + Before & After).
 *
 * Wordplay can't be sourced from a Wikipedia extract — it's constructed — so this
 * is a separate generator from the daily drafter (which skips language_wordplay).
 * See planning/wordplay-generator.md.
 *
 * It takes curated seed items, builds the clue, and VALIDATES each one before
 * emitting: anagram letters must match the answer; a Before & After pivot must
 * actually be shared; and no clue may contain its own answer's words (leak check).
 * Anything that fails validation throws — a malformed wordplay clue never ships.
 *
 *   node tools/acquisition/build-wordplay-pack.mjs
 *
 * Output: data/sourcing/packs/drafts/wordplay-001.json  (review -> dry-run -> PR)
 */

import fs from 'node:fs/promises';

const RANK = { 200: 1, 400: 2, 600: 3, 800: 4, 1000: 5 };
const letters = (s) => s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'this', 'that', 'these', 'with']);

// --- Anagrams: {scramble, answer, hint, value} — scramble is a real word/string
//     whose letters rearrange to the answer; hint disambiguates the target. ------
const ANAGRAMS = [
  { scramble: 'SILENT', answer: 'listen', hint: 'what you do with your ears', value: 200 },
  { scramble: 'THING', answer: 'night', hint: 'the dark half of the day', value: 200 },
  { scramble: 'STATE', answer: 'taste', hint: 'the sense centered on the tongue', value: 400 },
  { scramble: 'EARTH', answer: 'heart', hint: 'the organ that pumps blood', value: 400 },
  { scramble: 'DUSTY', answer: 'study', hint: 'what you do the night before an exam', value: 400 },
  { scramble: 'STRESSED', answer: 'desserts', hint: 'the sweet courses that end a meal', value: 600 },
  { scramble: 'A ROPE', answer: 'opera', hint: 'a drama set entirely to music', value: 600 },
  { scramble: 'THE EYES', answer: 'they see', hint: 'a two-word phrase about what eyes do (and a famous anagram of "the eyes")', value: 800 },
];

// --- Before & After: two well-known terms sharing a pivot word, spliced into one
//     answer. hint clues each half WITHOUT naming it. ---------------------------
const BEFORE_AFTER = [
  { first: 'Muhammad Ali', second: 'Ali Baba',
    hint: 'The boxer who floated like a butterfly runs into the hero who knew "open sesame."', value: 600 },
  { first: 'Tom Cruise', second: 'cruise control',
    hint: 'The Top Gun star meets the setting that holds your car at a steady speed.', value: 600 },
  { first: 'Jack Black', second: 'Black Widow',
    hint: 'The School of Rock comedian meets the Avengers’ red-headed Russian spy.', value: 800 },
  { first: 'Harrison Ford', second: 'Ford Mustang',
    hint: 'The actor who played Indiana Jones meets the classic American muscle car.', value: 600 },
  { first: 'Stephen King', second: 'King Kong',
    hint: 'The horror novelist behind "It" meets the giant ape of Skull Island.', value: 800 },
];

function buildAnagram(item, i) {
  if (letters(item.scramble) !== letters(item.answer)) {
    throw new Error(`anagram mismatch: "${item.scramble}" is not an anagram of "${item.answer}"`);
  }
  const clue = `Rearrange the letters of "${item.scramble}" to get ${item.hint}.`;
  return finalize({
    external_id: `wordplay-001-ana-${String(i + 1).padStart(2, '0')}`,
    subcategory_name: 'Anagrams',
    mechanic: 'anagram',
    clue,
    answer: item.answer,
    value: item.value,
    tags: ['wordplay', 'constructed', 'anagram'],
  });
}

function buildBeforeAfter(item, i) {
  const aWords = item.first.split(/\s+/);
  const bWords = item.second.split(/\s+/);
  const pivot = aWords[aWords.length - 1];
  if (pivot.toLowerCase() !== bWords[0].toLowerCase()) {
    throw new Error(`Before & After pivot mismatch: "${item.first}" / "${item.second}"`);
  }
  const answer = [...aWords, ...bWords.slice(1)].join(' '); // splice on the shared pivot
  const clue = `Before & After: ${item.hint}`;
  return finalize({
    external_id: `wordplay-001-baf-${String(i + 1).padStart(2, '0')}`,
    subcategory_name: 'Before & After',
    mechanic: 'before_after',
    clue,
    answer,
    value: item.value,
    tags: ['wordplay', 'constructed', 'before-after'],
  });
}

// Shared shaping + the leak guard: a wordplay clue must never contain a word of
// its own answer (case-insensitive, minus stopwords).
function finalize(q) {
  const clueWords = new Set(q.clue.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/));
  for (const w of q.answer.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w && !STOP.has(w) && clueWords.has(w)) {
      throw new Error(`answer leak: clue contains answer word "${w}" -> ${q.answer}`);
    }
  }
  return {
    source: 'constructed',
    source_url: null,
    external_id: q.external_id,
    category_id: 'language_wordplay',
    subcategory_name: q.subcategory_name,
    value: q.value,
    difficulty_rank: RANK[q.value] ?? 3,
    mechanic: q.mechanic,
    constraint_text: null,
    clue: q.clue,
    answer: q.answer,
    aliases: [],
    tags: q.tags,
    citations: [],
    verification_status: 'skipped', // constructed — nothing to source-verify
  };
}

const questions = [
  ...ANAGRAMS.map(buildAnagram),
  ...BEFORE_AFTER.map(buildBeforeAfter),
];

// Distinct answers (the import gate enforces this too, but fail early & clearly).
const seen = new Map();
for (const q of questions) {
  const k = q.answer.toLowerCase();
  if (seen.has(k)) throw new Error(`duplicate answer: ${q.answer}`);
  seen.set(k, true);
}

const pack = {
  generated_at: '2026-06-18',
  provider: 'constructed',
  category_id: 'language_wordplay',
  notes: ['Constructed wordplay (anagrams + Before & After). Not source-grounded; validated structurally by build-wordplay-pack.mjs.'],
  questions,
};
await fs.writeFile('data/sourcing/packs/drafts/wordplay-001.json', JSON.stringify(pack, null, 2) + '\n');
console.log(`Wrote ${questions.length} wordplay clues:`);
for (const q of questions) console.log(`  [${q.mechanic}] ${q.answer}  ::  ${q.clue}`);
