#!/usr/bin/env node
/**
 * Condense harvested (before -> after) rewrite pairs into per-pair transferable lessons. The EDIT
 * is the source of truth for "why"; the editor's review comment (harvest-review-comments) is a
 * SUPPLEMENTARY hint, joined by matching the clue text in its diff hunk. INCREMENTAL: pairs already
 * condensed (in clue-rewrite-lessons.jsonl) are skipped, so a daily run only pays for the newly
 * merged PR's handful of edits. Uses the `claude` CLI (Sonnet) via the shared llm-batch component.
 *
 *   node tools/acquisition/condense-rewrites.mjs   (after harvest-clue-rewrites + harvest-review-comments)
 */
import fs from 'node:fs';
import { batchClassify } from './llm-batch.mjs';

const load = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const rewrites = load('data/acquisition/clue-rewrites.jsonl');
const comments = load('data/acquisition/clue-comments.jsonl');
const existing = load('data/acquisition/clue-rewrite-lessons.jsonl');

const keyOf = (r) => `${r.pack}::${r.before}`;
const done = new Set(existing.map(keyOf));
const todo = rewrites.filter((r) => !done.has(keyOf(r)));
console.log(`${rewrites.length} rewrite(s) total; ${existing.length} already condensed; ${todo.length} new to condense.`);
if (!todo.length) process.exit(0);

// attach a supplementary comment (edit stays primary)
todo.forEach((r, i) => {
  r._id = i;
  const hits = comments.filter((c) => c.pack === r.pack && (c.hunk.includes(r.before.slice(0, 55)) || c.hunk.includes(r.after.slice(0, 55))));
  r.note = [...new Set(hits.map((h) => h.body))].join(' ⁊ ').slice(0, 300);
});

const TAXO = 'fill_trim, tighten_wording, unbury_subject, concrete_over_abstract, add_vivid_hook, cut_giveaway, cut_leak, fix_grammar, value_up, value_down, reframe_difficulty, dedup_reword, other';

const map = await batchClassify({
  items: todo,
  batchSize: 12,
  model: process.env.CONDENSE_MODEL || 'claude-sonnet-4-6',
  buildPrompt: (batch) => [
    "You are analyzing how a trivia editor rewrote a drafter's clues, to learn his editorial standard so a",
    'drafter can pre-apply it. For each item: BEFORE = the drafter\'s clue, AFTER = the editor\'s final clue.',
    'The EDIT ITSELF is the source of truth for WHY it changed. A reviewer NOTE may be attached as a HINT —',
    "use it only if it clarifies the edit; IGNORE it if it's off, terse, or just a value number.",
    'Output what changed (1-3 tags from this taxonomy) and a single transferable lesson (<=22 words,',
    `imperative, general enough to apply to NEW clues — not about this specific fact). Taxonomy: ${TAXO}.`,
    'Output ONLY a JSON object mapping each id (number, verbatim) to {"change_types":[...],"lesson":"..."} — no prose, no fences.',
    '',
    ...batch.map((r) => `id ${r._id}${r.value_before !== r.value_after ? ` [$${r.value_before}->$${r.value_after}]` : ''}:\n  BEFORE: ${r.before}\n  AFTER: ${r.after}${r.note ? `\n  NOTE(hint): ${r.note}` : ''}`),
  ].join('\n'),
  onBatch: ({ index, batches }) => console.error(`  batch ${index}/${batches}`),
});

const fresh = todo.map((r) => {
  const v = map.get(String(r._id)) || { change_types: ['unparsed'], lesson: '' };
  const { _id, note, ...rest } = r;
  return { ...rest, ...v };
});
fs.appendFileSync('data/acquisition/clue-rewrite-lessons.jsonl', fresh.map((l) => JSON.stringify(l)).join('\n') + '\n');
console.log(`Condensed ${fresh.length} new pair(s); corpus now ${existing.length + fresh.length}.`);
