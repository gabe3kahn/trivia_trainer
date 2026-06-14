/**
 * J! Archive QUALITY benchmark (calibration only).
 *
 * J! Archive clues are the paragon of well-written Jeopardy clues. So if our
 * quality gate would REJECT a real aired clue (decision = replace/deactivate),
 * that's almost always a FALSE POSITIVE in our rules — a rule that's too harsh.
 * This script runs the live intake assessment over a small sample of real clues
 * and reports the accept rate, the gating false-positive rate, and which rules
 * misfire most on known-good clues, so they can be softened or fixed.
 *
 * Like the difficulty benchmark, this does NOT import or persist clue text. It
 * writes only aggregates and source references; example clue text is printed to
 * the console transiently for the operator to eyeball.
 *
 * Usage:
 *   node tools/acquisition/benchmark-jarchive-quality.mjs
 *   node tools/acquisition/benchmark-jarchive-quality.mjs --games 9202,9171 --examples 20
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { assessQuestionForIntake } from './intake-assessment.mjs';
import { collectClues, DEFAULT_GAME_IDS, escapeCell, normalizeCategoryId, parseArgs, percent } from './jarchive-source.mjs';

const args = parseArgs(process.argv.slice(2));
const gameIds = (args.games ? String(args.games).split(',') : DEFAULT_GAME_IDS).map((id) => id.trim()).filter(Boolean);
const delayMs = Number(args.delayMs ?? 750);
const exampleCount = Number(args.examples ?? 12);

const { games, clues } = await collectClues(gameIds, { delayMs });

const evaluated = clues.map((clue) => {
  const assessment = assessQuestionForIntake({
    source: 'j_archive_quality_benchmark',
    category_id: normalizeCategoryId(clue.category),
    category_name: clue.category,
    subcategory_name: clue.category,
    value: clue.normalized_value,
    difficulty_rank: clue.row,
    mechanic: 'standard',
    clue: clue.clue,
    answer: clue.answer,
    aliases: [],
    tags: [],
  });

  return {
    clue,
    decision: assessment.quality.decision,
    score: assessment.quality.score,
    issues: assessment.quality.issues,
    warnings: assessment.quality.warnings ?? [],
  };
});

const total = evaluated.length;
const accepted = evaluated.filter((row) => row.decision === 'keep' || row.decision === 'rewrite');
const flagged = evaluated.filter((row) => row.decision === 'replace' || row.decision === 'deactivate');

const summary = {
  generated_at: new Date().toISOString(),
  source_note: 'Calibration only. J! Archive clues are not imported or persisted; only aggregates and source references are stored.',
  paragon_note:
    'J! Archive clues are well-written by definition. keep/rewrite = our rules accept; replace/deactivate on a real clue = a false positive (too-harsh rule).',
  games,
  total_clues: total,
  accept_rate: percent(accepted.length, total),
  gating_false_positive_rate: percent(flagged.length, total),
  mean_quality_score: Number((evaluated.reduce((sum, row) => sum + row.score, 0) / (total || 1)).toFixed(1)),
  decision_counts: countBy(evaluated, (row) => row.decision),
  issue_counts: countList(evaluated.flatMap((row) => row.issues)),
  warning_counts: countList(evaluated.flatMap((row) => row.warnings)),
  // The rules to look at first: those firing on clues we'd wrongly reject.
  false_positive_issue_counts: countList(flagged.flatMap((row) => row.issues)),
  flagged_samples: flagged.slice(0, 40).map((row) => ({
    source_ref: `${row.clue.round}_${row.clue.column}_${row.clue.row}`,
    game_id: row.clue.game_id,
    category: row.clue.category,
    decision: row.decision,
    score: row.score,
    issues: row.issues,
  })),
};

await fs.mkdir(path.join(process.cwd(), 'data', 'acquisition'), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'jarchive-quality-benchmark.json'),
  JSON.stringify(summary, null, 2),
);
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'jarchive-quality-benchmark.md'),
  renderMarkdown(summary),
);

console.log(`Quality-benchmarked ${total} J! Archive clues from ${games.length} games.`);
console.log(`Accept rate (keep/rewrite): ${summary.accept_rate}%`);
console.log(`Gating false positives (replace/deactivate on a real clue): ${flagged.length} (${summary.gating_false_positive_rate}%)`);
console.log(`Mean quality score: ${summary.mean_quality_score}`);

if (exampleCount > 0 && flagged.length > 0) {
  console.log(`\nExample rejected real clues (transient, not stored) — these reveal too-harsh rules:`);
  for (const row of flagged.slice(0, exampleCount)) {
    console.log(`  [${row.decision} ${row.score}] ${row.clue.clue}`);
    console.log(`      answer: ${row.clue.answer} | issues: ${row.issues.join(', ')}`);
  }
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countList(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function renderMarkdown(data) {
  const lines = [
    '# J! Archive Quality Benchmark',
    '',
    `Generated: ${data.generated_at}`,
    '',
    'Calibration only. J! Archive clues are not imported or persisted; only aggregates and source references are stored here.',
    '',
    '> J! Archive clues are well-written by definition. So `keep`/`rewrite` means our rules accept the clue, while `replace`/`deactivate` on a real aired clue is a **false positive** — a rule that is too harsh and should be softened.',
    '',
    '## Sample',
    '',
    '| Game | Aired | Clues | URL |',
    '| --- | --- | ---: | --- |',
    ...data.games.map((game) => `| ${game.gameId} | ${game.aired ?? ''} | ${game.clue_count} | ${game.url} |`),
    '',
    '## Headline',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Clues | ${data.total_clues} |`,
    `| Accept rate (keep/rewrite) | ${data.accept_rate}% |`,
    `| Gating false-positive rate (replace/deactivate) | ${data.gating_false_positive_rate}% |`,
    `| Mean quality score | ${data.mean_quality_score} |`,
    '',
    '## Decisions',
    '',
    '| Decision | Count |',
    '| --- | ---: |',
    ...['keep', 'rewrite', 'replace', 'deactivate'].map((key) => `| ${key} | ${data.decision_counts[key] ?? 0} |`),
    '',
    '## Rules Firing On Clues We Wrongly Reject',
    '',
    'These are the highest-priority rules to soften (they reject real, well-written clues).',
    '',
    '| Issue | Count |',
    '| --- | ---: |',
    ...Object.entries(data.false_positive_issue_counts).map(([issue, count]) => `| ${escapeCell(issue)} | ${count} |`),
    '',
    '## All Issue Hits (whole sample)',
    '',
    '| Issue | Count |',
    '| --- | ---: |',
    ...Object.entries(data.issue_counts).map(([issue, count]) => `| ${escapeCell(issue)} | ${count} |`),
    '',
    '## Warnings (non-scoring)',
    '',
    '| Warning | Count |',
    '| --- | ---: |',
    ...Object.entries(data.warning_counts).map(([warning, count]) => `| ${escapeCell(warning)} | ${count} |`),
    '',
    'Full machine-readable results: `data/acquisition/jarchive-quality-benchmark.json`',
    '',
  ];

  return `${lines.join('\n')}`;
}
