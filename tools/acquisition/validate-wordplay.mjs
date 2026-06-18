/**
 * Validate a constructed wordplay pack — the correctness gate for clues the daily
 * drafter generates (it writes the wit, this proves the mechanics are sound).
 * Each clue carries a `wp` block the validator checks:
 *   anagram      -> wp.scramble : letters must equal the answer's, and the
 *                   scramble must appear in the clue (case-insensitive)
 *   before_after -> wp.first/wp.second : must share a pivot word, and the answer
 *                   must be the splice on that pivot
 * Plus, for every clue: no answer word may appear in the clue (leak), and answers
 * must be distinct across the pack. Exits non-zero if anything fails.
 *
 *   node tools/acquisition/validate-wordplay.mjs data/sourcing/packs/drafts/wordplay-YYYY-MM-DD.json
 */

import fs from 'node:fs';

const packPath = process.argv[2];
if (!packPath) throw new Error('usage: validate-wordplay.mjs <pack.json>');

const letters = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'with', 'by', 'before', 'after', 'at',
  'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'do', 'does',
  'you', 'your', 'he', 'she', 'it', 'its', 'his', 'her', 'they', 'them', 'their',
  'what', 'when', 'who', 'not', 'as',
]);
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

const data = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const qs = data.questions || data;
const fails = [];
const seen = new Map();

for (const q of qs) {
  const id = q.external_id || q.answer;
  const fail = (msg) => fails.push(`${id}: ${msg}`);
  const wp = q.wp || {};

  // distinct answers across the pack
  const ak = String(q.answer).toLowerCase().trim();
  if (seen.has(ak)) fail(`duplicate answer "${q.answer}"`); else seen.set(ak, true);

  // leak guard — no distinctive answer word in the clue
  const clueWords = new Set(words(q.clue));
  for (const w of words(q.answer)) if (!STOP.has(w) && clueWords.has(w)) fail(`answer word "${w}" leaks into the clue`);

  if (q.mechanic === 'anagram') {
    if (!wp.scramble) { fail('anagram missing wp.scramble'); continue; }
    if (letters(wp.scramble) !== letters(q.answer)) fail(`"${wp.scramble}" is not an anagram of "${q.answer}"`);
    if (!q.clue.toLowerCase().includes(String(wp.scramble).toLowerCase())) fail(`clue must contain the scramble "${wp.scramble}"`);
  } else if (q.mechanic === 'before_after') {
    if (!wp.first || !wp.second) { fail('before_after missing wp.first/wp.second'); continue; }
    const a = String(wp.first).split(/\s+/), b = String(wp.second).split(/\s+/);
    if (a[a.length - 1].toLowerCase() !== b[0].toLowerCase()) fail(`"${wp.first}" / "${wp.second}" share no pivot word`);
    const splice = [...a, ...b.slice(1)].join(' ');
    if (letters(splice) !== letters(q.answer)) fail(`answer "${q.answer}" is not the splice "${splice}"`);
  } else {
    fail(`unsupported wordplay mechanic "${q.mechanic}"`);
  }
}

if (fails.length) {
  console.error(`✗ ${fails.length} wordplay validation failure(s):`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✓ ${qs.length} wordplay clues valid (anagram letters, Before & After splice, no leaks, distinct answers).`);
