/**
 * Daily acquisition job (run by the TriviaTrainer-JArchiveHarvest scheduled task).
 *
 * Two deterministic phases, a few minutes total:
 *   1. Harvest ~5 recent J! Archive games → grow per-category topic stores.
 *   2. For every category with a topic store, fetch a few NEW cited Wikipedia
 *      docs for its top not-yet-documented topics (idempotent; skips existing).
 *
 * So each morning the "what to ask" topic signal AND the cited source corpus
 * both grow a little, across all categories. Clue *authoring* is intentionally
 * NOT here — that stays a reviewed step (see the draft-clues routine).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const node = process.execPath;
const acq = 'tools/acquisition';
const docsPerCategory = Number(process.argv.includes('--docs') ? process.argv[process.argv.indexOf('--docs') + 1] : 6);

function run(script, args) {
  console.log(`\n› node ${script} ${args.join(' ')}`);
  const r = spawnSync(node, [path.join(acq, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) console.log(`  (${script} exited ${r.status})`);
}

// 1. Harvest the day's games.
run('jarchive-daily-harvest.mjs', []);

// 2. Top up the cited doc corpus for every category that has a topic store.
const topicsDir = path.join('data', 'sourcing', 'topics');
const categories = fs.existsSync(topicsDir)
  ? fs.readdirSync(topicsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  : [];

console.log(`\nFetching up to ${docsPerCategory} new docs each for ${categories.length} categories…`);
for (const category of categories) {
  run('build-topic-docs.mjs', ['--category', category, '--limit', String(docsPerCategory)]);
}

console.log('\nDaily job complete.');
