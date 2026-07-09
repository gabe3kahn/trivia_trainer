#!/usr/bin/env node
/**
 * Condense harvested (before -> after) rewrite pairs into per-pair transferable lessons. For a TEXT
 * edit the EDIT is the source of truth for "why" and the review comment is a SUPPLEMENTARY hint; for a
 * DIFFICULTY-ONLY edit (value_only: text unchanged) the comment IS the signal. Comments are joined by
 * matching the answer's JSON line or the clue text in the diff hunk. INCREMENTAL: pairs already
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

// key on before AND after so a value-only edit (before===after) never masks a later text edit of the same clue.
const keyOf = (r) => `${r.pack}::${r.before}::${r.after}`;
const done = new Set(existing.map(keyOf));
const todo = rewrites.filter((r) => !done.has(keyOf(r)));

// attach a supplementary comment (edit stays primary; for a value-only edit the comment IS the signal).
// Match by the answer's JSON line in the hunk (robust for value-only, where the diff centers on the
// value line) OR by the clue text appearing in the hunk.
todo.forEach((r, i) => {
  r._id = i;
  const ansNeedle = `"answer": ${JSON.stringify(r.answer)}`;
  const hits = comments.filter((c) => c.pack === r.pack
    && (c.hunk.includes(ansNeedle) || c.hunk.includes(r.before.slice(0, 55)) || c.hunk.includes(r.after.slice(0, 55))));
  r.note = [...new Set(hits.map((h) => h.body))].join(' ⁊ ').slice(0, 300);
});

// A value-only edit with NO explanation teaches nothing (identical text, no "why"). Skip it — leave it
// uncondensed so it's retried on a future run if the editor later adds a comment.
const condensable = todo.filter((r) => !(r.value_only && !r.note));
console.log(`${rewrites.length} rewrite(s) total; ${existing.length} already condensed; ${condensable.length} new to condense (${todo.length - condensable.length} value-only w/o note skipped).`);
if (!condensable.length) process.exit(0);

const TAXO = 'fill_trim, tighten_wording, unbury_subject, concrete_over_abstract, add_vivid_hook, cut_giveaway, cut_leak, fix_grammar, value_up, value_down, reframe_difficulty, dedup_reword, other';

const map = await batchClassify({
  items: condensable,
  batchSize: 12,
  model: process.env.CONDENSE_MODEL || 'claude-sonnet-4-6',
  buildPrompt: (batch) => [
    "You are analyzing how a trivia editor rewrote a drafter's clues, to learn his editorial standard so a",
    'drafter can pre-apply it. For each item: BEFORE = the drafter\'s clue, AFTER = the editor\'s final clue.',
    'The EDIT ITSELF is the source of truth for WHY it changed. A reviewer NOTE may be attached as a HINT —',
    "use it only if it clarifies the edit; IGNORE it if it's off, terse, or just a value number.",
    'Some items are marked [DIFFICULTY-ONLY]: the clue TEXT did not change — the editor only re-valued it.',
    'For those, the NOTE is the SOURCE OF TRUTH (there is no text delta); derive a transferable',
    'difficulty-calibration lesson and tag it value_up / value_down / reframe_difficulty.',
    'Output what changed (1-3 tags from this taxonomy) and a single transferable lesson (<=22 words,',
    `imperative, general enough to apply to NEW clues — not about this specific fact). Taxonomy: ${TAXO}.`,
    'Output ONLY a JSON object mapping each id (number, verbatim) to {"change_types":[...],"lesson":"..."} — no prose, no fences.',
    '',
    ...batch.map((r) => {
      const vtag = r.value_before !== r.value_after ? ` [$${r.value_before}->$${r.value_after}]` : '';
      if (r.value_only) {
        return `id ${r._id} [DIFFICULTY-ONLY${vtag}] (clue text UNCHANGED — the NOTE explains the re-valuation):\n  CLUE: ${r.before}\n  NOTE(why): ${r.note}`;
      }
      return `id ${r._id}${vtag}:\n  BEFORE: ${r.before}\n  AFTER: ${r.after}${r.note ? `\n  NOTE(hint): ${r.note}` : ''}`;
    }),
  ].join('\n'),
  onBatch: ({ index, batches }) => console.error(`  batch ${index}/${batches}`),
});

const fresh = condensable.map((r) => {
  const v = map.get(String(r._id)) || { change_types: ['unparsed'], lesson: '' };
  const { _id, note, ...rest } = r;
  return { ...rest, ...v };
});
fs.appendFileSync('data/acquisition/clue-rewrite-lessons.jsonl', fresh.map((l) => JSON.stringify(l)).join('\n') + '\n');
console.log(`Condensed ${fresh.length} new pair(s); corpus now ${existing.length + fresh.length}.`);
