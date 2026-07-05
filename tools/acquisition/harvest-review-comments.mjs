#!/usr/bin/env node
/**
 * Harvest the human editor's inline PR review comments on non-wordplay draft packs, so the condense
 * step can use them as a SUPPLEMENTARY hint (the edit itself stays the source of truth). ONLY
 * gabe3kahn's top-level comments — the drafter bot posts replies from a different account, and
 * those must not pollute the signal.
 *
 * Output: data/acquisition/clue-comments.jsonl  [{pr, pack, body, hunk}]
 *   node tools/acquisition/harvest-review-comments.mjs   (needs an authenticated `gh`)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = process.env.HARVEST_REPO || 'gabe3kahn/trivia_trainer';
const REVIEWER = process.env.HARVEST_REVIEWER || 'gabe3kahn'; // the human editor's account (NOT the bot)
const gh = (args) => { try { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch { return ''; } };

const prs = JSON.parse(gh(['pr', 'list', '--repo', REPO, '--state', 'all', '--limit', '300', '--json', 'number,state']) || '[]')
  .filter((p) => p.state === 'MERGED' || p.state === 'CLOSED');

const out = [];
for (const { number } of prs) {
  let comments;
  try { comments = JSON.parse(gh(['api', `repos/${REPO}/pulls/${number}/comments`, '--paginate']) || '[]'); } catch { continue; }
  for (const c of comments) {
    const path = c.path || '';
    if (!/packs\/drafts\/.*\.json$/.test(path) || /wordplay/i.test(path)) continue;
    if (c.in_reply_to_id) continue; // top-level review comments only (replies are the bot's)
    if (c.user?.login !== REVIEWER) continue; // the editor's review account only
    out.push({ pr: number, pack: path.split('/').pop(), body: (c.body || '').replace(/\s+/g, ' ').trim(), hunk: c.diff_hunk || '' });
  }
}
fs.mkdirSync('data/acquisition', { recursive: true });
fs.writeFileSync('data/acquisition/clue-comments.jsonl', out.map((c) => JSON.stringify(c)).join('\n') + '\n');
console.log(`Harvested ${out.length} ${REVIEWER} review comment(s) on non-wordplay draft packs.`);
