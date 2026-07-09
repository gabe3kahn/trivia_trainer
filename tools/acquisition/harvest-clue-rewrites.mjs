#!/usr/bin/env node
/**
 * Harvest (original draft clue -> human-approved final clue) pairs from git history — the raw
 * material for the drafter's learned rewrite lessons. The merge-commit workflow preserves both
 * ends: a draft pack's ADD commit holds the drafter's original; the current file holds the
 * merged/edited final. The diff between them IS the human edit — ground truth, independent of any
 * review comment. Wordplay packs are excluded (their lessons live in the wordplay rules).
 *
 * Outputs (data/acquisition/):
 *   clue-rewrites.jsonl   — one record per clue whose text changed {pack,category,id,answer,before,after,value_*}
 *   drafter-metrics.jsonl — per-pack edit-rate {pack,category,total,rewritten,value_changed,dropped,edit_rate}
 *                           (the "are we improving?" signal — edit_rate should fall over time)
 *
 *   node tools/acquisition/harvest-clue-rewrites.mjs   (run from repo root, full git history)
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const git = (...args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const DRAFTS = 'data/sourcing/packs/drafts';
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const packs = fs.existsSync(DRAFTS) ? fs.readdirSync(DRAFTS).filter((f) => f.endsWith('.json') && !/wordplay/i.test(f)) : [];
const rewrites = [];
const metrics = [];
const labeled = [];

for (const file of packs) {
  const rel = `${DRAFTS}/${file}`;
  const commits = git('log', '--format=%H', '--', rel).stdout.trim().split('\n').filter(Boolean);
  if (commits.length < 2) continue; // need >=2 commits to have a post-draft edit
  const addCommit = git('log', '--diff-filter=A', '--format=%H', '--', rel).stdout.trim().split('\n').filter(Boolean).pop();
  if (!addCommit) continue;
  let original, final;
  try { original = JSON.parse(git('show', `${addCommit}:${rel}`).stdout); } catch { continue; }
  try { final = JSON.parse(fs.readFileSync(rel, 'utf8')); } catch { continue; }
  const oq = original.questions || original;
  const fq = final.questions || final;
  const fById = new Map(fq.map((q) => [q.external_id || q.answer, q]));

  let rewritten = 0, valueChanged = 0, dropped = 0;
  for (const o of oq) {
    const id = o.external_id || o.answer;
    const f = fById.get(id);
    if (!f) { dropped += 1; continue; }
    const textChanged = norm(o.clue) !== norm(f.clue);
    // labeled row for the eval / restraint examples: edit = clue text changed, keep = unchanged
    // (a value-only change counts as keep here — the text was not touched; that's a difficulty edit, below).
    labeled.push({ category: o.category_id, answer: o.answer, before: norm(o.clue), after: norm(f.clue), action: textChanged ? 'edit' : 'keep' });
    if (textChanged) {
      rewritten += 1;
      rewrites.push({ pack: file, category: o.category_id, id, answer: o.answer, before: norm(o.clue), after: norm(f.clue), value_before: o.value, value_after: f.value });
    } else if (o.value !== f.value) {
      // Value-only edit: the editor changed difficulty without touching the text. Capture it as a
      // rewrite too so condense learns the calibration — the "why" is in the review COMMENT (there is
      // no text delta to read), so it's flagged value_only for condense to key off the comment.
      valueChanged += 1;
      rewrites.push({ pack: file, category: o.category_id, id, answer: o.answer, before: norm(o.clue), after: norm(f.clue), value_before: o.value, value_after: f.value, value_only: true });
    }
  }
  metrics.push({ pack: file, category: (oq[0] || {}).category_id, total: oq.length, rewritten, value_changed: valueChanged, dropped, edit_rate: Number(((rewritten + valueChanged + dropped) / Math.max(1, oq.length)).toFixed(3)) });
}

fs.mkdirSync('data/acquisition', { recursive: true });
fs.writeFileSync('data/acquisition/clue-rewrites.jsonl', rewrites.map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync('data/acquisition/labeled-clues.jsonl', labeled.map((l) => JSON.stringify(l)).join('\n') + '\n');
fs.writeFileSync('data/acquisition/drafter-metrics.jsonl', metrics.map((m) => JSON.stringify(m)).join('\n') + '\n');
const avg = metrics.length ? (metrics.reduce((a, m) => a + m.edit_rate, 0) / metrics.length) : 0;
console.log(`Harvested ${rewrites.length} rewrite(s) from ${metrics.length} pack(s); mean edit_rate ${avg.toFixed(3)}.`);
