/**
 * Mine the human edits applied to drafted clues — the feedback signal for the
 * drafter. For each draft pack, diff the version the drafter first proposed
 * (its first git commit) against the version that actually merged to main, per
 * clue (matched on external_id), and classify what changed.
 *
 * Cross-category: captures value calibration, category re-homes, clue rewrites,
 * drops, alias/leak fixes — across ALL categories, not just wordplay.
 *
 *   node tools/acquisition/mine-clue-edits.mjs            # all draft packs on main
 *   node tools/acquisition/mine-clue-edits.mjs <pack.json>
 *
 * Outputs:
 *   data/acquisition/clue-edits.jsonl   one record per changed/dropped clue
 *   data/acquisition/clue-edits.md      human-readable digest grouped by edit type
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const tryGit = (cmd) => { try { return git(cmd); } catch { return ''; } };
const norm = (a) => String(a ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const RANK_VAL = { 1: 200, 2: 400, 3: 600, 4: 800, 5: 1000 };

const arg = process.argv[2];
const packs = arg
  ? [arg]
  : git('ls-files data/sourcing/packs/drafts/*.json').split('\n').filter(Boolean);

const edits = [];

for (const pack of packs) {
  // First commit that introduced this pack = the drafter's proposal.
  const firstCommit = tryGit(`log --diff-filter=A --format=%H -- "${pack}"`).split('\n').filter(Boolean).pop();
  if (!firstCommit) continue;
  const proposed = parsePack(tryGit(`show ${firstCommit}:"${pack}"`));
  const final = parsePack(tryGit(`show main:"${pack}"`));
  if (!proposed.length && !final.length) continue;

  const byId = (arr) => new Map(arr.filter((q) => q.external_id).map((q) => [q.external_id, q]));
  const P = byId(proposed);
  const F = byId(final);

  for (const [id, p] of P) {
    const f = F.get(id);
    if (!f) {
      edits.push(record(pack, id, p, null, ['dropped'], { answer: p.answer, category: p.category_id }));
      continue;
    }
    const types = [];
    const detail = { answer: f.answer, category: f.category_id };
    if ((p.value ?? RANK_VAL[p.difficulty_rank]) !== (f.value ?? RANK_VAL[f.difficulty_rank])) {
      types.push((f.value ?? 0) > (p.value ?? 0) ? 'value-up' : 'value-down');
      detail.value = `${p.value} -> ${f.value}`;
    }
    if (p.category_id !== f.category_id || norm(p.subcategory_name) !== norm(f.subcategory_name)) {
      types.push('recategorized');
      detail.from = `${p.category_id} / ${p.subcategory_name}`;
      detail.to = `${f.category_id} / ${f.subcategory_name}`;
    }
    if (String(p.clue).trim() !== String(f.clue).trim()) {
      types.push('reworded');
      detail.before = p.clue;
      detail.after = f.clue;
    }
    if (norm((p.aliases ?? []).join('|')) !== norm((f.aliases ?? []).join('|'))) {
      types.push('aliases-changed');
      detail.aliases = `${JSON.stringify(p.aliases ?? [])} -> ${JSON.stringify(f.aliases ?? [])}`;
    }
    if (types.length) edits.push(record(pack, id, p, f, types, detail));
  }
  for (const [id, f] of F) {
    if (!P.has(id)) edits.push(record(pack, id, null, f, ['added-in-review'], { answer: f.answer, category: f.category_id }));
  }
}

fs.mkdirSync('data/acquisition', { recursive: true });
fs.writeFileSync('data/acquisition/clue-edits.jsonl', edits.map((e) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync('data/acquisition/clue-edits.md', digest(edits));

const byType = {};
for (const e of edits) for (const t of e.types) byType[t] = (byType[t] ?? 0) + 1;
console.log(`Mined ${edits.length} edited clues across ${packs.length} packs.`);
console.log('By edit type:', JSON.stringify(byType));
console.log('Wrote data/acquisition/clue-edits.{jsonl,md}');

/* ------------------------------------------------------------------ */
function parsePack(text) {
  if (!text) return [];
  try { const j = JSON.parse(text); return j.questions ?? (Array.isArray(j) ? j : []); } catch { return []; }
}
function record(pack, id, p, f, types, detail) {
  return { pack: path.basename(pack), external_id: id, types, ...detail };
}
function digest(edits) {
  const groups = {};
  for (const e of edits) for (const t of e.types) (groups[t] ??= []).push(e);
  let out = `# Clue edits (drafter feedback signal)\n\nWhat humans changed between the drafted version and the merged version, by type.\n`;
  for (const [type, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    out += `\n## ${type} (${list.length})\n`;
    for (const e of list) {
      if (type === 'reworded') out += `- **${e.answer}** (${e.category})\n  - before: ${e.before}\n  - after:  ${e.after}\n`;
      else if (type === 'recategorized') out += `- **${e.answer}**: ${e.from} → ${e.to}\n`;
      else if (type.startsWith('value')) out += `- **${e.answer}** (${e.category}): ${e.value}\n`;
      else if (type === 'aliases-changed') out += `- **${e.answer}**: ${e.aliases}\n`;
      else out += `- **${e.answer}** (${e.category})\n`;
    }
  }
  return out;
}
