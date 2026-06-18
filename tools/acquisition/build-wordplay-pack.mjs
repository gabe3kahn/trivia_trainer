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
// Function words that may freely appear in a clue without counting as an answer
// leak — pronouns, articles, prepositions, common in the woven-sentence style.
const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'with', 'by', 'before', 'after', 'at',
  'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'do', 'does',
  'you', 'your', 'he', 'she', 'it', 'its', 'his', 'her', 'they', 'them', 'their',
  'what', 'when', 'who', 'not', 'as',
]);

// --- Anagrams: the scramble word is woven into a witty sentence in NORMAL case
//     (not highlighted) — the solver has to spot which word to rearrange, so the
//     puzzle isn't a giveaway on a non-timed question. The answer is its anagram
//     and fits the sentence. The builder validates scramble↔answer + presence. --
const ANAGRAMS = [
  { scramble: 'silent', answer: 'listen', value: 200,
    clue: 'Something you might be doing with your ears while you are silent' },
  { scramble: 'thing', answer: 'night', value: 200,
    clue: 'The thing that falls over the dark half of the day' },
  { scramble: 'state', answer: 'taste', value: 400,
    clue: 'State the sense centered on the tongue' },
  { scramble: 'earth', answer: 'heart', value: 400,
    clue: 'The meek will inherit the earth, not the faint of this' },
  { scramble: 'dusty', answer: 'study', value: 400,
    clue: 'A dusty desk is a bad place to do this before an exam' },
  { scramble: 'stressed', answer: 'desserts', value: 600,
    clue: 'Careful not to eat too much of this when you are stressed' },
  { scramble: 'a rope', answer: 'opera', value: 600,
    clue: 'You won’t need a rope to get tied up in the drama of this all-sung art form' },
  { scramble: 'the eyes', answer: 'they see', value: 800,
    clue: 'Use the eyes to do what they do' },
];

// --- Before & After: two well-known terms sharing a pivot word, spliced into one
//     answer. The clue is a single narrative that names neither half outright. --
const BEFORE_AFTER = [
  { first: 'Muhammad Ali', second: 'Ali Baba', value: 600,
    clue: 'The boxer who floated like a butterfly says "open sesame" before stinging like a bee' },
  { first: 'Tom Cruise', second: 'cruise control', value: 600,
    clue: 'The Top Gun star needs to hold his jet at a steady speed' },
  { first: 'Jack Black', second: 'Black Widow', value: 800,
    clue: 'The School of Rock teacher inducts a red-headed Avenger as his star pupil' },
  { first: 'Harrison Ford', second: 'Ford Mustang', value: 600,
    clue: 'The archaeologist actor digs up the frame of a classic muscle car' },
  { first: 'Stephen King', second: 'King Kong', value: 800,
    clue: 'The horror novelist adds a giant ape to the top of his Dark Tower' },
];

function buildAnagram(item, i) {
  if (letters(item.scramble) !== letters(item.answer)) {
    throw new Error(`anagram mismatch: "${item.scramble}" is not an anagram of "${item.answer}"`);
  }
  if (!item.clue.toLowerCase().includes(item.scramble.toLowerCase())) {
    throw new Error(`anagram clue must contain the scramble "${item.scramble}": ${item.clue}`);
  }
  return finalize({
    external_id: `wordplay-001-ana-${String(i + 1).padStart(2, '0')}`,
    subcategory_name: 'Anagrams',
    mechanic: 'anagram',
    clue: item.clue,
    answer: item.answer,
    value: item.value,
    tags: ['wordplay', 'constructed', 'anagram'],
    wp: { scramble: item.scramble },
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
  return finalize({
    external_id: `wordplay-001-baf-${String(i + 1).padStart(2, '0')}`,
    subcategory_name: 'Before & After',
    mechanic: 'before_after',
    clue: item.clue,
    answer,
    value: item.value,
    tags: ['wordplay', 'constructed', 'before-after'],
    wp: { first: item.first, second: item.second },
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
    wp: q.wp, // validation provenance (scramble / first+second) for validate-wordplay.mjs
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
