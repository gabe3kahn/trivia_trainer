import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluateDifficulty, rankToValue } from './difficulty-rules.mjs';
import { collectClues, DEFAULT_GAME_IDS, escapeCell, normalizeCategoryId, parseArgs, percent } from './jarchive-source.mjs';

const args = parseArgs(process.argv.slice(2));
const gameIds = (args.games ? String(args.games).split(',') : DEFAULT_GAME_IDS).map((id) => id.trim()).filter(Boolean);
const delayMs = Number(args.delayMs ?? 750);

const { games, clues: allClues } = await collectClues(gameIds, { delayMs });

const evaluated = allClues.map((clue) => {
  const difficulty = evaluateDifficulty({
    source: 'j_archive_benchmark',
    category_id: normalizeCategoryId(clue.category),
    subcategory_name: clue.category,
    value: clue.normalized_value,
    difficulty_rank: clue.row,
    mechanic: 'standard',
    clue: clue.clue,
    answer: clue.answer,
    aliases: [],
    tags: ['j-archive-benchmark'],
  });

  return {
    ...clue,
    suggested_value: difficulty.suggested_value,
    suggested_rank: difficulty.suggested_rank,
    delta_rank: difficulty.suggested_rank - clue.row,
    verdict: difficulty.verdict,
    confidence: difficulty.confidence,
    reasons: difficulty.reasons,
  };
});

const summary = {
  generated_at: new Date().toISOString(),
  source_note: 'Benchmark only. J! Archive clues are not imported into the app question bank.',
  games,
  total_clues: evaluated.length,
  overall: summarize(evaluated),
  by_round: summarizeBy(evaluated, (row) => row.round),
  by_actual_value: summarizeBy(evaluated, (row) => String(row.normalized_value)),
  by_category: summarizeBy(evaluated, (row) => row.category),
  calibration: calibrate(evaluated),
  reason_counts: reasonCounts(evaluated),
  largest_drift: evaluated
    .toSorted((a, b) => Math.abs(b.delta_rank) - Math.abs(a.delta_rank) || b.confidence - a.confidence)
    .slice(0, 50)
    .map(renderRow),
};

await fs.mkdir(path.join(process.cwd(), 'data', 'acquisition'), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'jarchive-difficulty-benchmark.json'),
  JSON.stringify(summary, null, 2),
);
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'jarchive-difficulty-benchmark.md'),
  renderMarkdown(summary),
);

console.log(`Benchmarked ${evaluated.length} J! Archive clues from ${games.length} games.`);
console.log(`Exact rank match: ${summary.overall.exact_match} (${summary.overall.exact_match_rate}%)`);
console.log(`Within one row: ${summary.overall.within_one} (${summary.overall.within_one_rate}%)`);
console.log(`Average delta rank: ${summary.overall.average_delta_rank}`);
console.log('Per-rank bias (negative = we rate too easy, positive = too hard):');
for (const row of summary.calibration.by_actual_rank) {
  console.log(`  $${row.actual_value} (rank ${row.actual_rank}): mean suggested ${row.mean_suggested_rank}, bias ${row.bias >= 0 ? '+' : ''}${row.bias}`);
}

/**
 * Calibration view: how our suggested rank lines up with the real board rank,
 * broken out per actual rank. `bias` is mean(suggested) - actual: negative means
 * we systematically rate that tier too easy, positive too hard. This is the
 * signal for retuning difficulty-rules.mjs against the J! Archive paragon.
 */
function calibrate(items) {
  const byActualRank = [];
  const confusion = {};

  for (let rank = 1; rank <= 5; rank += 1) {
    const group = items.filter((item) => item.row === rank);
    const distribution = {};
    for (const item of group) distribution[item.suggested_rank] = (distribution[item.suggested_rank] ?? 0) + 1;
    confusion[rank] = distribution;

    const meanSuggested = group.length ? group.reduce((sum, item) => sum + item.suggested_rank, 0) / group.length : 0;
    const mae = group.length ? group.reduce((sum, item) => sum + Math.abs(item.suggested_rank - rank), 0) / group.length : 0;

    byActualRank.push({
      actual_rank: rank,
      actual_value: rankToValue(rank),
      count: group.length,
      mean_suggested_rank: Number(meanSuggested.toFixed(2)),
      bias: Number((meanSuggested - rank).toFixed(2)),
      mean_absolute_error: Number(mae.toFixed(2)),
    });
  }

  const count = items.length;
  const mae = count ? items.reduce((sum, item) => sum + Math.abs(item.delta_rank), 0) / count : 0;
  const overallBias = count ? items.reduce((sum, item) => sum + item.delta_rank, 0) / count : 0;

  return {
    mean_absolute_error: Number(mae.toFixed(2)),
    overall_bias: Number(overallBias.toFixed(2)),
    by_actual_rank: byActualRank,
    confusion,
  };
}

function summarize(items) {
  const count = items.length;
  const exact = items.filter((row) => row.delta_rank === 0).length;
  const withinOne = items.filter((row) => Math.abs(row.delta_rank) <= 1).length;
  const avgDelta = count ? items.reduce((sum, row) => sum + row.delta_rank, 0) / count : 0;
  const avgAbsDelta = count ? items.reduce((sum, row) => sum + Math.abs(row.delta_rank), 0) / count : 0;
  return {
    count,
    exact_match: exact,
    exact_match_rate: percent(exact, count),
    within_one: withinOne,
    within_one_rate: percent(withinOne, count),
    average_delta_rank: Number(avgDelta.toFixed(2)),
    average_absolute_delta_rank: Number(avgAbsDelta.toFixed(2)),
    suggested_easier: items.filter((row) => row.delta_rank < 0).length,
    suggested_same: exact,
    suggested_harder: items.filter((row) => row.delta_rank > 0).length,
  };
}

function summarizeBy(items, keyFn) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    groups[key] ??= [];
    groups[key].push(item);
  }
  return Object.fromEntries(Object.entries(groups).sort().map(([key, values]) => [key, summarize(values)]));
}

function reasonCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const reason of item.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function renderRow(row) {
  return {
    game_id: row.game_id,
    aired: row.aired,
    round: row.round,
    source_ref: `${row.round}_${row.column}_${row.row}`,
    category: row.category,
    actual_value: row.normalized_value,
    suggested_value: row.suggested_value,
    delta_rank: row.delta_rank,
    confidence: row.confidence,
    reasons: row.reasons,
  };
}

function renderMarkdown(summary) {
  const lines = [
    '# J! Archive Difficulty Benchmark',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'This is a calibration benchmark only. J! Archive clues are not imported into the app question bank.',
    '',
    '## Sample',
    '',
    '| Game | Aired | Clues | URL |',
    '| --- | --- | ---: | --- |',
    ...summary.games.map((game) => `| ${game.gameId} | ${game.aired ?? ''} | ${game.clue_count} | ${game.url} |`),
    '',
    '## Overall',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Clues | ${summary.total_clues} |`,
    `| Exact row match | ${summary.overall.exact_match_rate}% |`,
    `| Within one row | ${summary.overall.within_one_rate}% |`,
    `| Avg delta rank | ${summary.overall.average_delta_rank} |`,
    `| Avg absolute delta rank | ${summary.overall.average_absolute_delta_rank} |`,
    `| Suggested easier than J! row | ${summary.overall.suggested_easier} |`,
    `| Suggested same as J! row | ${summary.overall.suggested_same} |`,
    `| Suggested harder than J! row | ${summary.overall.suggested_harder} |`,
    '',
    '## By Actual Value',
    '',
    '| Actual Value | Count | Exact | Within 1 | Avg Delta | Suggested Easier | Same | Harder |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary.by_actual_value).map(([value, row]) => `| $${value} | ${row.count} | ${row.exact_match_rate}% | ${row.within_one_rate}% | ${row.average_delta_rank} | ${row.suggested_easier} | ${row.suggested_same} | ${row.suggested_harder} |`),
    '',
    '## Calibration vs J! Archive',
    '',
    `Mean absolute rank error: **${summary.calibration.mean_absolute_error}** · Overall bias: **${summary.calibration.overall_bias}** (negative = we rate too easy)`,
    '',
    '| Actual Value | Count | Mean Suggested Rank | Bias | MAE |',
    '| ---: | ---: | ---: | ---: | ---: |',
    ...summary.calibration.by_actual_rank.map((row) => `| $${row.actual_value} | ${row.count} | ${row.mean_suggested_rank} | ${row.bias >= 0 ? '+' : ''}${row.bias} | ${row.mean_absolute_error} |`),
    '',
    '## Largest Drift Samples',
    '',
    '| Actual | Suggested | Delta | Category | Source Ref | Reasons |',
    '| ---: | ---: | ---: | --- | --- | --- |',
    ...summary.largest_drift.slice(0, 25).map((row) => `| $${row.actual_value} | $${row.suggested_value} | ${row.delta_rank} | ${escapeCell(row.category)} | ${escapeCell(row.source_ref)} | ${row.reasons.slice(0, 4).join(', ')} |`),
    '',
    'Full machine-readable results: `data/acquisition/jarchive-difficulty-benchmark.json`',
    '',
  ];

  return `${lines.join('\n')}`;
}
