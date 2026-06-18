/**
 * Mine the human feedback on drafted clues — the signal the drafter learns from.
 * For each draft pack: (1) diff the version the drafter first proposed (its first
 * git commit) against the version that merged to main, per clue (matched on
 * external_id), classifying the change [the WHAT]; and (2) pull that PR's review
 * comments and pair each with the clue it was about [the WHY] — via the GitHub
 * API (gh), top-level comments only (skips the bot's threaded replies).
 *
 * Cross-category: value calibration, category re-homes, rewrites, drops, alias
 * fixes — and the reasoning behind them — across ALL categories, not just wordplay.
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

// GitHub helpers — pull the human's review comments (the WHY behind each edit).
const REPO = (tryGit('remote get-url origin').match(/github\.com[:/]([^/]+\/[^/.]+)/) || [])[1] || '';
const gh = (cmd) => { try { return execSync(`gh ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); } catch { return ''; } };
const ghJson = (cmd) => { const o = gh(cmd); try { return o ? JSON.parse(o) : null; } catch { return null; } };

// Map a review comment to the clue it's about. GitHub anchors the comment to the
// line it's on; in our pretty-printed packs that's a clue's "clue" line, whose
// nearest preceding "answer" in the diff hunk is the PREVIOUS clue — so the comment
// is about the clue AFTER the last answer shown in the hunk.
function commentAnchor(diffHunk, proposed) {
  const answers = String(diffHunk || '').split('\n')
    .map((l) => (l.match(/"answer":\s*"([^"]*)"/) || [])[1]).filter(Boolean);
  if (!answers.length) return proposed[0] || null;
  const last = answers[answers.length - 1];
  const idx = proposed.findIndex((q) => q.answer === last);
  if (idx >= 0 && idx + 1 < proposed.length) return proposed[idx + 1];
  return proposed.find((q) => q.answer === last) || null;
}

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

  // Attach the human's review comments (the WHY) to the clues they touch.
  // Fetch raw JSON and filter in node — avoids shell-quoting jq under Windows cmd.
  if (REPO && firstCommit) {
    const prs = ghJson(`api repos/${REPO}/commits/${firstCommit}/pulls`);
    const pr = Array.isArray(prs) && prs[0] ? prs[0].number : null;
    if (pr) {
      const all = ghJson(`api repos/${REPO}/pulls/${pr}/comments?per_page=100`) || [];
      const comments = (Array.isArray(all) ? all : []).filter((c) => c.in_reply_to_id == null);
      const base = path.basename(pack);
      for (const c of comments) {
        const note = String(c.body).replace(/\s+/g, ' ').trim();
        if (!note) continue;
        const clue = commentAnchor(c.diff_hunk, proposed);
        const id = clue?.external_id ?? null;
        const existing = id && edits.find((e) => e.pack === base && e.external_id === id);
        if (existing) (existing.reviewer_notes ??= []).push(note);
        else edits.push({ pack: base, external_id: id, types: ['comment-only'], answer: clue?.answer ?? '(unanchored)', reviewer_notes: [note] });
      }
    }
  }
}

fs.mkdirSync('data/acquisition', { recursive: true });
fs.writeFileSync('data/acquisition/clue-edits.jsonl', edits.map((e) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync('data/acquisition/clue-edits.md', digest(edits));

const byType = {};
for (const e of edits) for (const t of e.types) byType[t] = (byType[t] ?? 0) + 1;
const noteCount = edits.reduce((n, e) => n + (e.reviewer_notes?.length ?? 0), 0);
console.log(`Mined ${edits.length} edited clues across ${packs.length} packs.`);
console.log('By edit type:', JSON.stringify(byType));
console.log(`Paired ${noteCount} review comments (the WHY)${REPO ? '' : ' — no git remote, comments skipped'}.`);
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
  // comment-only records are shown in the reviewer-notes section, not the type groups
  for (const e of edits) for (const t of e.types) if (t !== 'comment-only') (groups[t] ??= []).push(e);
  let out = `# Clue edits (drafter feedback signal)\n\nWhat humans changed between the drafted and merged versions (the WHAT), plus the review comments that drove it (the WHY).\n`;
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
  // The WHY: review comments paired with the clue (and its edit) they were about.
  const noted = edits.filter((e) => e.reviewer_notes?.length);
  if (noted.length) {
    out += `\n## reviewer notes — the WHY (${noted.length})\n`;
    for (const e of noted) {
      const what = e.types.filter((t) => t !== 'comment-only').join(', ') || 'no diff edit';
      out += `- **${e.answer}** [${what}]\n` + e.reviewer_notes.map((n) => `  - "${n}"`).join('\n') + '\n';
    }
  }
  return out;
}
