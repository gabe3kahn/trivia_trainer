/**
 * Daily J! Archive harvester — incremental, respectful, resumable.
 *
 * Each run reads only a few games (default 5), parses their clues, and folds the
 * answers + category titles into a persistent per-category topic store. State is
 * tracked so runs never re-process a game and the harvester walks the archive
 * newest-season-first, a little each day. Designed to run every morning for a
 * few minutes (e.g. Windows Task Scheduler), so the topic/source corpus
 * compounds over time without ever hammering j-archive.com.
 *
 * Outputs (all under data/sourcing/):
 *   harvest-state.json          — processed game ids, season cursor, pending queue
 *   topics/<category_id>.json   — accumulating answer + category-title frequency
 *   harvest-log.jsonl           — one line per run (audit trail)
 *
 * Usage:
 *   node tools/acquisition/jarchive-daily-harvest.mjs
 *   node tools/acquisition/jarchive-daily-harvest.mjs --perRun 6 --delayMs 4000
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchText, normalizeCategoryId, parseArgs, parseGame, wait } from './jarchive-source.mjs';

const args = parseArgs(process.argv.slice(2));
const perRun = Number(args.perRun ?? 5);
const delayMs = Number(args.delayMs ?? 3500);

const root = process.cwd();
const sourcingDir = path.join(root, 'data', 'sourcing');
const topicsDir = path.join(sourcingDir, 'topics');
const statePath = path.join(sourcingDir, 'harvest-state.json');
const logPath = path.join(sourcingDir, 'harvest-log.jsonl');

await fs.mkdir(topicsDir, { recursive: true });

const state = await loadJson(statePath, {
  created_at: new Date().toISOString(),
  last_run: null,
  seasons: [], // archive season tokens, newest-first
  season_index: 0, // next season to expand into the queue
  pending_game_ids: [], // discovered but not yet processed
  processed_game_ids: [], // already harvested
  processed_count: 0,
});

const processedSet = new Set(state.processed_game_ids);

// 1. Make sure we know the archive's seasons (cached after first run).
if (!state.seasons.length) {
  state.seasons = await fetchSeasons();
  console.log(`Discovered ${state.seasons.length} seasons (newest-first).`);
}

// 2. Top up the pending queue from the next season(s) until we have enough.
while (state.pending_game_ids.length < perRun && state.season_index < state.seasons.length) {
  const season = state.seasons[state.season_index];
  state.season_index += 1;
  try {
    const gameIds = await fetchSeasonGameIds(season);
    let added = 0;
    for (const gid of gameIds) {
      if (!processedSet.has(gid) && !state.pending_game_ids.includes(gid)) {
        state.pending_game_ids.push(gid);
        added += 1;
      }
    }
    console.log(`Season ${season}: queued ${added} new game(s).`);
  } catch (error) {
    console.log(`Season ${season} listing failed: ${error.message}`);
  }
  await wait(delayMs);
}

if (!state.pending_game_ids.length) {
  console.log('Nothing left to harvest — the archive has been fully walked. 🎉');
  await saveJson(statePath, state);
  process.exit(0);
}

// 3. Harvest a small batch.
const batch = state.pending_game_ids.slice(0, perRun);
const runStats = { games: 0, clues: 0, categories_touched: new Set() };
const touchedTopics = new Map(); // category_id -> store (lazy-loaded)

console.log(`\nHarvesting ${batch.length} game(s)…`);
for (const gid of batch) {
  try {
    const url = `https://j-archive.com/showgame.php?game_id=${encodeURIComponent(gid)}`;
    const game = parseGame(await fetchText(url), { gameId: gid, url });
    for (const clue of game.clues) await foldClue(clue, touchedTopics, runStats);
    runStats.games += 1;
    console.log(`  game ${gid}: ${game.clues.length} clues (${game.aired ?? 'date n/a'})`);
  } catch (error) {
    console.log(`  game ${gid} failed: ${error.message}`);
  } finally {
    processedSet.add(gid);
    state.processed_game_ids.push(gid);
  }
  await wait(delayMs);
}

// 4. Persist accumulated topic stores + state + log.
for (const [categoryId, store] of touchedTopics) {
  store.updated_at = new Date().toISOString();
  await saveJson(path.join(topicsDir, `${categoryId}.json`), store);
}

state.pending_game_ids = state.pending_game_ids.filter((gid) => !processedSet.has(gid));
state.processed_count = state.processed_game_ids.length;
state.last_run = new Date().toISOString();
await saveJson(statePath, state);

const logEntry = {
  run_at: state.last_run,
  games: runStats.games,
  clues: runStats.clues,
  categories_touched: [...runStats.categories_touched],
  processed_total: state.processed_count,
  pending_remaining: state.pending_game_ids.length,
  seasons_expanded: state.season_index,
};
await fs.appendFile(logPath, `${JSON.stringify(logEntry)}\n`);

console.log(
  `\nHarvested ${runStats.clues} clues from ${runStats.games} game(s) across ${logEntry.categories_touched.length} categories.`,
);
console.log(`Lifetime: ${state.processed_count} games processed, ${state.pending_game_ids.length} queued.`);
console.log(`Topic stores updated in data/sourcing/topics/.`);

/* ------------------------------------------------------------------ */

async function foldClue(clue, touched, stats) {
  const answer = String(clue.answer ?? '').trim();
  if (!answer) return;
  const categoryId = normalizeCategoryId(clue.category);
  const store = await getTopicStore(categoryId, touched);

  store.total_clues_seen += 1;
  stats.clues += 1;
  stats.categories_touched.add(categoryId);

  const title = String(clue.category ?? '').trim();
  if (title) store.category_titles[title] = (store.category_titles[title] ?? 0) + 1;

  const key = answer.toLowerCase();
  const entry = (store.answers[key] ??= { display: answer, count: 0, values: [], example_clue: clue.clue ?? '' });
  entry.count += 1;
  if (clue.normalized_value != null && !entry.values.includes(clue.normalized_value)) {
    entry.values.push(clue.normalized_value);
  }
}

async function getTopicStore(categoryId, touched) {
  if (touched.has(categoryId)) return touched.get(categoryId);
  const store = await loadJson(path.join(topicsDir, `${categoryId}.json`), {
    category_id: categoryId,
    updated_at: null,
    total_clues_seen: 0,
    category_titles: {},
    answers: {},
  });
  touched.set(categoryId, store);
  return store;
}

async function fetchSeasons() {
  const html = await fetchText('https://j-archive.com/listseasons.php');
  // Seasons appear newest-first on the page; preserve that order, dedupe.
  const tokens = [...html.matchAll(/showseason\.php\?season=([^"&]+)/g)].map((m) => m[1]);
  return [...new Set(tokens)];
}

async function fetchSeasonGameIds(season) {
  const html = await fetchText(`https://j-archive.com/showseason.php?season=${encodeURIComponent(season)}`);
  const ids = [...html.matchAll(/showgame\.php\?game_id=(\d+)/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

async function loadJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    throw error;
  }
}

async function saveJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}
