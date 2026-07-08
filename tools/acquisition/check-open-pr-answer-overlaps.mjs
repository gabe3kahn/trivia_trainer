#!/usr/bin/env node
/**
 * Warn when this run's answers overlap answers proposed in OTHER open `draft-clues/*` PRs.
 *
 * The deterministic bank-collision gate only sees ACTIVE bank clues. An answer sitting in a
 * sibling, still-unmerged draft PR is invisible to it, so two runs can independently ship the
 * same answer; whichever merges second then collides at import (exactly the #99/#107 "Ice" case).
 * This surfaces those overlaps into the PR body so the human de-dups BEFORE merging, instead of
 * discovering it as a skipped clue at import time. Advisory — never fails the build.
 *
 *   node tools/acquisition/check-open-pr-answer-overlaps.mjs <pack.json> [...] [--append <pr-body.md>]
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = process.env.HARVEST_REPO || 'gabe3kahn/trivia_trainer';
const CURRENT_BRANCH = process.env.DRAFT_BRANCH || '';
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const gh = (a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const args = process.argv.slice(2);
let appendTo = null;
const packs = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--append') { appendTo = args[i + 1]; i += 1; continue; }
  packs.push(args[i]);
}
if (!packs.length) { console.error('usage: check-open-pr-answer-overlaps.mjs <pack.json> [...] [--append <file>]'); process.exit(1); }

// This run's answers (primary + aliases) -> the display answer.
const mine = new Map();
for (const p of packs) {
  let data; try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
  for (const q of data.questions || []) {
    for (const a of [q.answer, ...(Array.isArray(q.aliases) ? q.aliases : [])]) {
      const k = norm(a); if (k) mine.set(k, q.answer);
    }
  }
}

// Other open draft PRs' answers -> PR number(s).
let openPrs = [];
try {
  openPrs = JSON.parse(gh(['pr', 'list', '--repo', REPO, '--state', 'open', '--json', 'number,headRefName', '--limit', '50']))
    .filter((p) => /^draft-clues\//.test(p.headRefName) && p.headRefName !== CURRENT_BRANCH);
} catch (e) { console.warn('cross-PR check skipped (gh unavailable):', String(e.message).slice(0, 80)); process.exit(0); }

const overlaps = []; // { answer, pr }
for (const pr of openPrs) {
  // Only the draft packs this PR CHANGES vs main (not the whole drafts/ dir the branch carries) —
  // those are the NEW clues it proposes. Already-merged packs are handled by the bank gate.
  let changed;
  try { changed = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', REPO, '--json', 'files'])).files.map((f) => f.path); } catch { continue; }
  for (const p of changed.filter((x) => /^data\/sourcing\/packs\/drafts\/.*\.json$/.test(x))) {
    let txt;
    try { txt = Buffer.from(gh(['api', `repos/${REPO}/contents/${p}?ref=${pr.headRefName}`, '--jq', '.content']), 'base64').toString('utf8'); } catch { continue; }
    let qs; try { qs = JSON.parse(txt).questions || []; } catch { continue; }
    for (const q of qs) {
      for (const a of [q.answer, ...(Array.isArray(q.aliases) ? q.aliases : [])]) {
        const k = norm(a);
        if (k && mine.has(k)) overlaps.push({ answer: mine.get(k), pr: pr.number });
      }
    }
  }
}

// De-dupe (answer, pr) pairs.
const seen = new Set();
const uniq = overlaps.filter((o) => { const k = `${norm(o.answer)}#${o.pr}`; if (seen.has(k)) return false; seen.add(k); return true; });

if (!uniq.length) { console.log('No answer overlaps with open draft PRs.'); process.exit(0); }

const byPr = {};
for (const o of uniq) (byPr[o.pr] ||= []).push(o.answer);
const lines = ['', '## ⚠️ Answer overlaps with open draft PRs',
  'These answers are ALSO proposed in other open, unmerged draft PRs. The bank-collision gate can\'t',
  'see them yet (they\'re not active), so whichever PR merges second will have that clue **skipped**',
  'at import. De-dupe before merging — keep the better clue, drop/reword the other:', ''];
for (const pr of Object.keys(byPr)) lines.push(`- vs **#${pr}**: ${[...new Set(byPr[pr])].map((a) => `\`${a}\``).join(', ')}`);
const section = lines.join('\n') + '\n';

console.log(section);
if (appendTo) {
  try { fs.appendFileSync(appendTo, section); console.log(`Appended overlap warning to ${appendTo}.`); }
  catch (e) { console.warn(`Could not append to ${appendTo}: ${String(e.message).slice(0, 80)}`); }
}
