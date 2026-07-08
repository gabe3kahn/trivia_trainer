#!/usr/bin/env node
/**
 * Normalize the ANSWER casing of wordplay clues to the house convention, deterministically — so the
 * daily wordplay (constructed by the LLM draft pass, which cases inconsistently) doesn't need to be
 * hand-fixed. The convention, matching how answers render on the FE and the cleaned bank:
 *   • crossword  → UPPERCASE  (fits the letter-slot grid, e.g. "(6) _ A _ _ _ _")
 *   • every other wordplay mechanic (anagram, hidden_word, before_after, homophone, rhyme_time,
 *     initials) → Title Case  (so "ICE"/"ice" → "Ice", not shouted on the FE)
 * Only all-caps or all-lowercase answers are re-cased, so an intentionally mixed proper-noun answer
 * ("Eleanor Roosevelt", "Muhammad Ali Baba") is left untouched. Non-wordplay clues are ignored.
 *
 *   node tools/acquisition/normalize-wordplay-casing.mjs <pack.json> [<pack.json> …]
 */
import fs from 'node:fs';

const WORDPLAY = new Set(['anagram', 'hidden_word', 'before_after', 'homophone', 'rhyme_time', 'initials', 'crossword']);
const isMonoCase = (s) => s === s.toUpperCase() || s === s.toLowerCase(); // all-caps or all-lower → safe to re-case
const titleCase = (s) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const packs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!packs.length) { console.error('usage: normalize-wordplay-casing.mjs <pack.json> [<pack.json> …]'); process.exit(1); }

let changed = 0;
for (const p of packs) {
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
  const questions = data.questions || data;
  let touched = 0;
  for (const q of questions) {
    if (!WORDPLAY.has(q.mechanic) || typeof q.answer !== 'string') continue;
    const want = q.mechanic === 'crossword' ? q.answer.toUpperCase() : (isMonoCase(q.answer) ? titleCase(q.answer) : q.answer);
    if (want !== q.answer) { console.log(`  [${q.mechanic}] ${q.answer} -> ${want}`); q.answer = want; touched += 1; }
  }
  if (touched) { fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`); changed += touched; console.log(`${p}: normalized ${touched} answer(s)`); }
}
console.log(changed ? `Normalized ${changed} wordplay answer(s).` : 'No wordplay casing changes needed.');
