/**
 * Shared J! Archive source loader for CALIBRATION ONLY.
 *
 * J! Archive is the paragon corpus: real, aired Jeopardy clues with known board
 * values. We use it to measure (a) how well our difficulty model matches real
 * board values and (b) how often our quality rules wrongly flag a known-good
 * clue. Per the product plan, we do NOT import or persist J! Archive clue text
 * into the question bank — these loaders fetch a small sample, hold it in
 * memory for measurement, and the benchmark scripts persist only aggregates
 * and source references (never the clue/answer text).
 *
 * Be a good citizen: small samples, a real delay between requests, no crawling.
 */

import { rankToValue } from './difficulty-rules.mjs';

export const DEFAULT_GAME_IDS = ['9202', '9171', '9121', '9095', '9086'];

/**
 * Fetch and parse the given games. Returns { games, clues } where each clue has
 * board metadata plus { clue, answer } text for in-memory evaluation.
 */
export async function collectClues(gameIds, { delayMs = 750 } = {}) {
  const games = [];
  const clues = [];

  for (const gameId of gameIds) {
    const url = `https://j-archive.com/showgame.php?game_id=${encodeURIComponent(gameId)}`;
    const html = await fetchText(url);
    const game = parseGame(html, { gameId, url });
    games.push({ gameId, url, title: game.title, aired: game.aired, clue_count: game.clues.length });
    clues.push(...game.clues);
    if (delayMs > 0) await wait(delayMs);
  }

  return { games, clues };
}

export function parseGame(html, game) {
  const title = textFromMatch(html.match(/<div id="game_title"><h1>(.*?)<\/h1><\/div>/s)?.[1] ?? `J! Archive game ${game.gameId}`);
  const aired = title.match(/- ([A-Za-z]+, [A-Za-z]+ \d{1,2}, \d{4})/)?.[1] ?? null;
  const categories = parseCategories(html);
  const clues = [];
  const cluePattern = /<td id="clue_((?:J|DJ)_(\d+)_(\d+))" class="clue_text">(.*?)<\/td>\s*<td id="clue_\1_r" class="clue_text" style="display:none;">(.*?)<\/td>/gs;

  for (const match of html.matchAll(cluePattern)) {
    const clueKey = match[1];
    const round = clueKey.startsWith('DJ_') ? 'DJ' : 'J';
    const column = Number(match[2]);
    const row = Number(match[3]);
    const clue = textFromMatch(match[4]);
    const responseHtml = match[5];
    const answerMatch = responseHtml.match(/<em class="correct_response">(.*?)<\/em>/s);
    const answer = answerMatch ? textFromMatch(answerMatch[1]) : '';

    if (!clue || !answer) continue;

    clues.push({
      game_id: game.gameId,
      game_url: game.url,
      game_title: title,
      aired,
      round,
      column,
      row,
      category: categories[`${round}_${column}`] ?? 'Unknown',
      show_value: round === 'DJ' ? row * 400 : row * 200,
      normalized_value: rankToValue(row),
      clue,
      answer,
    });
  }

  return { ...game, title, aired, clues };
}

function parseCategories(html) {
  const categories = {};
  const roundSections = [
    ['J', sectionBetween(html, '<div id="jeopardy_round">', '<div id="double_jeopardy_round">')],
    ['DJ', sectionBetween(html, '<div id="double_jeopardy_round">', '<div id="final_jeopardy_round">')],
  ];

  for (const [round, section] of roundSections) {
    let column = 0;
    for (const match of section.matchAll(/<td class="category_name">(.*?)<\/td>/gs)) {
      column += 1;
      categories[`${round}_${column}`] = textFromMatch(match[1]);
    }
  }

  return categories;
}

function sectionBetween(text, startToken, endToken) {
  const start = text.indexOf(startToken);
  if (start === -1) return '';
  const end = text.indexOf(endToken, start + startToken.length);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

export function textFromMatch(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&eacute;/g, 'e')
    .replace(/&uuml;/g, 'u')
    .replace(/&nbsp;/g, ' ');
}

export function normalizeCategoryId(category) {
  const lower = String(category ?? '').toLowerCase();
  if (/\b(book|author|novel|literature|poem|poetry)\b/.test(lower)) return 'literature_books';
  if (/\b(history|president|war|treaty|ancient|century)\b/.test(lower)) return 'history';
  if (/\b(geography|capital|country|river|city|state|map)\b/.test(lower)) return 'geography';
  if (/\b(science|biology|chemistry|physics|space|animal)\b/.test(lower)) return 'science';
  if (/\b(art|artist|painting|architecture|museum)\b/.test(lower)) return 'arts_visual_culture';
  if (/\b(music|opera|theater|broadway|song)\b/.test(lower)) return 'music_performing_arts';
  if (/\b(religion|bible|myth|philosophy|god)\b/.test(lower)) return 'religion_mythology_philosophy';
  if (/\b(word|letter|rhyme|before|after|idiom)\b/.test(lower)) return 'language_wordplay';
  if (/\b(sport|game|baseball|football|basketball)\b/.test(lower)) return 'sports_games_leisure';
  return 'pop_culture_media_modern_life';
}

export function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

export function percent(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TriviaTrainerCalibration/0.1',
    },
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.text();
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1]?.startsWith('--') ? true : argv[index + 1] ?? true;
    parsed[key] = value;
    if (value !== true) index += 1;
  }
  return parsed;
}
