/**
 * Validate a constructed wordplay pack — the correctness gate for clues the daily
 * drafter generates (it writes the wit, this proves the mechanics are sound).
 * Each clue carries a `wp` block the validator checks:
 *   anagram      -> wp.scramble : letters must equal the answer's, a DIFFERENT word,
 *                   present in the clue, and the clue is a natural sentence (no "___")
 *   before_after -> wp.first/wp.second : must share a pivot word, and the answer
 *                   must be the splice on that pivot
 *   homophone    -> wp.homophone : a different spelling that sounds like the answer,
 *                   woven into the clue (phonetic match is human-reviewed)
 *   hidden_word  -> wp.hidden_in : a longer phrase (in the clue) that conceals the
 *                   answer as consecutive letters, e.g. "cat" in "lo[cat]ion"
 *   initials     -> wp.initials : a normal clue + the answer's initials as the hint;
 *                   the initials must equal the first letter of each answer word
 *   crossword    -> wp.length + wp.pattern : answer >=4 letters, must be that length, and
 *                   the pattern reveals EXACTLY ONE letter, e.g. "___S___" for WHISKEY
 *   rhyme_time   -> wp.rhyme_pair : answer is a rhyming pair (rhyme human-reviewed)
 * Plus, for every clue: no answer word may appear in the clue as a standalone token
 * (leak), and answers must be distinct across the pack. Exits non-zero if anything fails.
 *
 *   node tools/acquisition/validate-wordplay.mjs data/sourcing/packs/drafts/wordplay-YYYY-MM-DD.json
 */

import fs from 'node:fs';

const packPath = process.argv[2];
if (!packPath) throw new Error('usage: validate-wordplay.mjs <pack.json>');

const letters = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); // case/space-insensitive, order preserved
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
    if (flat(wp.scramble) === flat(q.answer)) fail(`scramble "${wp.scramble}" is the same word as the answer`);
    if (!q.clue.toLowerCase().includes(String(wp.scramble).toLowerCase())) fail(`clue must contain the scramble "${wp.scramble}"`);
    // Wrong format: a fill-in-the-blank telegraphs the answer. The clue must be a
    // natural sentence whose meaning the answer completes — never a "___" blank.
    if (/_{2,}/.test(q.clue)) fail('anagram clue must be a natural sentence with NO fill-in-the-blank ("___")');
  } else if (q.mechanic === 'before_after') {
    if (!wp.first || !wp.second) { fail('before_after missing wp.first/wp.second'); continue; }
    const a = String(wp.first).split(/\s+/), b = String(wp.second).split(/\s+/);
    if (a[a.length - 1].toLowerCase() !== b[0].toLowerCase()) fail(`"${wp.first}" / "${wp.second}" share no pivot word`);
    const splice = [...a, ...b.slice(1)].join(' ');
    if (letters(splice) !== letters(q.answer)) fail(`answer "${q.answer}" is not the splice "${splice}"`);
  } else if (q.mechanic === 'homophone') {
    // The answer sounds like wp.homophone but is spelled differently; the clue plays
    // on the soundalike. Phonetic equivalence is human-reviewed (no pronunciation
    // dictionary here) — we enforce structure: distinct spelling + soundalike present.
    if (!wp.homophone) { fail('homophone missing wp.homophone'); continue; }
    if (flat(wp.homophone) === flat(q.answer)) fail(`homophone "${wp.homophone}" must be spelled differently from "${q.answer}"`);
    if (!q.clue.toLowerCase().includes(String(wp.homophone).toLowerCase())) fail(`homophone clue must weave in the soundalike "${wp.homophone}"`);
  } else if (q.mechanic === 'hidden_word') {
    // The answer hides as consecutive letters inside wp.hidden_in (which appears in
    // the clue) — e.g. "cat" inside "lo[cat]ion". The standalone-word leak guard above
    // still applies, so the answer can't also appear as its own word.
    if (!wp.hidden_in) { fail('hidden_word missing wp.hidden_in'); continue; }
    const hay = flat(wp.hidden_in), needle = flat(q.answer);
    if (!needle) fail('hidden_word answer is empty');
    else if (!hay.includes(needle)) fail(`answer "${q.answer}" is not hidden inside "${wp.hidden_in}"`);
    else if (hay === needle) fail(`"${wp.hidden_in}" must be longer than the answer (genuinely hidden)`);
    if (!q.clue.toLowerCase().includes(String(wp.hidden_in).toLowerCase())) fail(`hidden_word clue must contain the carrier "${wp.hidden_in}"`);
  } else if (q.mechanic === 'initials') {
    // A normal trivia clue; the answer's INITIALS are shown as the hint. Verify the given
    // initials equal the first letter of each answer word. The leak guard above already
    // ensures the clue doesn't contain the answer's words.
    if (!wp.initials) { fail('initials missing wp.initials'); continue; }
    const aWords = words(q.answer);
    if (aWords.length < 2) fail(`initials answer "${q.answer}" should be multi-word (initials need >=2 words)`);
    const derived = aWords.map((w) => w[0]).join('');
    const given = String(wp.initials).toLowerCase().replace(/[^a-z]/g, '');
    if (given !== derived) fail(`initials "${wp.initials}" don't match the answer's word-initials ("${derived.toUpperCase()}")`);
  } else if (q.mechanic === 'crossword') {
    // Clue + length + a revealed-letter pattern (e.g. "___S___"). Verify the answer fits
    // the length and every revealed letter. (Leak guard above blocks naming the answer.)
    if (!wp.pattern) { fail('crossword missing wp.pattern'); continue; }
    const ans = flat(q.answer);
    const pat = String(wp.pattern).toLowerCase().replace(/[^a-z0-9_]/g, '');
    // The length + revealed letter do a lot of the work, so keep the hint minimal:
    // exactly ONE revealed letter, and a word long enough to be a real puzzle (>=4).
    const revealed = pat.replace(/_/g, '').length;
    if (ans.length < 4) fail(`crossword answer "${q.answer}" must be at least 4 letters`);
    if (revealed !== 1) fail(`crossword pattern must reveal exactly ONE letter (got ${revealed} in "${wp.pattern}")`);
    if (wp.length != null && Number(wp.length) !== ans.length) fail(`crossword wp.length ${wp.length} != answer length ${ans.length}`);
    if (pat.length !== ans.length) fail(`crossword pattern length ${pat.length} != answer length ${ans.length}`);
    else for (let i = 0; i < pat.length; i += 1) {
      if (pat[i] !== '_' && pat[i] !== ans[i]) fail(`crossword pattern mismatch at position ${i + 1}: pattern "${pat[i]}" vs answer "${ans[i]}"`);
    }
  } else if (q.mechanic === 'rhyme_time') {
    // Answer is a rhyming pair (e.g. "fat cat") clued by description. The rhyme itself is
    // human-reviewed (no pronunciation dictionary); enforce structure: two distinct words
    // whose join equals the answer.
    const pair = wp.rhyme_pair;
    if (!Array.isArray(pair) || pair.length < 2) { fail('rhyme_time missing wp.rhyme_pair (>=2 words)'); continue; }
    if (flat(pair.join('')) !== flat(q.answer)) fail(`rhyme_time answer "${q.answer}" != the pair "${pair.join(' ')}"`);
    if (pair.length === 2 && flat(pair[0]) === flat(pair[1])) fail('rhyme_time pair must be two different words');
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
