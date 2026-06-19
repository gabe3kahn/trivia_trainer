/**
 * Daily J! Archive harvester — incremental, respectful, resumable.
 *
 * Each run reads only a few games (default 5), parses their clues, and folds the
 * answers into a single flat TOPIC POOL keyed by answer. The (often punny, always
 * misleading) Jeopardy category titles are NOT used to bucket — relevance comes
 * later from LLM subject keywords (keyword-topics.mjs). State is tracked so runs
 * never re-process a game and the harvester walks the archive newest-season-first,
 * a little each day, so the pool compounds over time without hammering j-archive.com.
 *
 * Outputs (all under data/sourcing/):
 *   harvest-state.json   — processed game ids, season cursor, pending queue
 *   topics/pool.json      — accumulating {answer → count, values, example_clue, keywords}
 *   harvest-log.jsonl    — one line per run (audit trail)
 *
 * Usage:
 *   node tools/acquisition/jarchive-daily-harvest.mjs
 *   node tools/acquisition/jarchive-daily-harvest.mjs --perRun 6 --delayMs 4000
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchText, parseArgs, parseGame, wait } from './jarchive-source.mjs';

const args = parseArgs(process.argv.slice(2));
const perRun = Number(args.perRun ?? 5);
const delayMs = Number(args.delayMs ?? 3500);

const root = process.cwd();
const sourcingDir = path.join(root, 'data', 'sourcing');
const topicsDir = path.join(sourcingDir, 'topics');
const statePath = path.join(sourcingDir, 'harvest-state.json');
const logPath = path.join(sourcingDir, 'harvest-log.jsonl');
const poolPath = path.join(topicsDir, 'pool.json');

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
const runStats = { games: 0, clues: 0, new_topics: 0 };
// Single flat pool — load the existing one so we preserve its topics + keywords
// and accumulate; new answers come in un-keyworded (keyword-topics.mjs tags them).
const pool = await loadJson(poolPath, { updated_at: null, topic_count: 0, topics: {} });

console.log(`\nHarvesting ${batch.length} game(s)…`);
for (const gid of batch) {
  try {
    const url = `https://j-archive.com/showgame.php?game_id=${encodeURIComponent(gid)}`;
    const game = parseGame(await fetchText(url), { gameId: gid, url });
    for (const clue of game.clues) foldClue(clue, pool, runStats);
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

// 4. Persist the pool + state + log.
pool.updated_at = new Date().toISOString();
pool.topic_count = Object.keys(pool.topics).length;
await saveJson(poolPath, pool);

state.pending_game_ids = state.pending_game_ids.filter((gid) => !processedSet.has(gid));
state.processed_count = state.processed_game_ids.length;
state.last_run = new Date().toISOString();
await saveJson(statePath, state);

const logEntry = {
  run_at: state.last_run,
  games: runStats.games,
  clues: runStats.clues,
  new_topics: runStats.new_topics,
  topic_total: pool.topic_count,
  processed_total: state.processed_count,
  pending_remaining: state.pending_game_ids.length,
  seasons_expanded: state.season_index,
};
await fs.appendFile(logPath, `${JSON.stringify(logEntry)}\n`);

console.log(`\nHarvested ${runStats.clues} clues from ${runStats.games} game(s); ${runStats.new_topics} new topics.`);
console.log(`Lifetime: ${state.processed_count} games processed, ${state.pending_game_ids.length} queued.`);
console.log(`Topic pool: ${pool.topic_count} topics → data/sourcing/topics/pool.json (run keyword-topics.mjs to tag new ones).`);

/* ------------------------------------------------------------------ */

function foldClue(clue, pool, stats) {
  const answer = String(clue.answer ?? '').trim();
  if (!answer) return;
  stats.clues += 1;

  const key = answer.toLowerCase();
  let entry = pool.topics[key];
  if (!entry) {
    entry = pool.topics[key] = { display: answer, count: 0, values: [], example_clue: clue.clue ?? '', keywords: [] };
    stats.new_topics += 1;
  }
  entry.count += 1;
  if (!entry.example_clue && clue.clue) entry.example_clue = clue.clue;
  if (clue.normalized_value != null && !entry.values.includes(clue.normalized_value)) {
    entry.values.push(clue.normalized_value);
  }
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
