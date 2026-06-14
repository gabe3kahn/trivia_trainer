import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { evaluateDifficulty } from './difficulty-rules.mjs';

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(
  request,
  '/rest/v1/questions?select=id,source,category_id,categories(name),subcategories(name),value,difficulty_rank,mechanic,constraint_text,clue,answer,aliases,tags,quality_status&is_active=eq.true',
);

const evaluated = rows
  .map((row) => ({ ...row, difficulty: evaluateDifficulty(row) }))
  .toSorted((a, b) => Math.abs(b.difficulty.delta_rank) - Math.abs(a.difficulty.delta_rank) || b.difficulty.confidence - a.difficulty.confidence);

const summary = {
  generated_at: new Date().toISOString(),
  total_active: rows.length,
  overall: summarize(evaluated),
  by_category: summarizeBy(evaluated, (row) => row.category_id),
  by_current_value: summarizeBy(evaluated, (row) => String(row.value)),
  reason_counts: reasonCounts(evaluated),
  likely_overrated: evaluated
    .filter((row) => row.difficulty.delta_rank <= -2 || (row.difficulty.delta_rank <= -1 && row.difficulty.confidence >= 0.7))
    .slice(0, 80)
    .map(renderRow),
  likely_underrated: evaluated
    .filter((row) => row.difficulty.delta_rank >= 2 || (row.difficulty.delta_rank >= 1 && row.difficulty.confidence >= 0.75))
    .slice(0, 80)
    .map(renderRow),
  all: evaluated.map(renderRow),
};

await fs.mkdir(path.join(process.cwd(), 'data', 'acquisition'), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'difficulty-evaluation.json'),
  JSON.stringify(summary, null, 2),
);
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'difficulty-evaluation.md'),
  renderMarkdown(summary),
);

console.log(`Evaluated difficulty for ${rows.length} active questions.`);
console.log(`Likely overrated: ${summary.likely_overrated.length}`);
console.log(`Likely underrated: ${summary.likely_underrated.length}`);
console.log(`Average suggested value: $${summary.overall.average_suggested_value}`);

function summarize(items) {
  const total = items.length;
  const avgSuggested = total ? Math.round(items.reduce((sum, row) => sum + row.difficulty.suggested_value, 0) / total / 10) * 10 : 0;
  return {
    count: total,
    average_suggested_value: avgSuggested,
    calibrated: items.filter((row) => row.difficulty.delta_rank === 0).length,
    possibly_overrated: items.filter((row) => row.difficulty.delta_rank === -1).length,
    likely_overrated: items.filter((row) => row.difficulty.delta_rank <= -2).length,
    possibly_underrated: items.filter((row) => row.difficulty.delta_rank === 1).length,
    likely_underrated: items.filter((row) => row.difficulty.delta_rank >= 2).length,
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
    for (const reason of item.difficulty.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function renderRow(row) {
  return {
    id: row.id,
    source: row.source,
    category_id: row.category_id,
    category_name: row.categories?.name ?? row.category_id,
    subcategory_name: row.subcategories?.name ?? null,
    current_value: row.value,
    suggested_value: row.difficulty.suggested_value,
    verdict: row.difficulty.verdict,
    confidence: row.difficulty.confidence,
    reasons: row.difficulty.reasons,
    clue: row.clue,
    answer: row.answer,
  };
}

function renderMarkdown(summary) {
  const over = summary.likely_overrated.slice(0, 60);
  const under = summary.likely_underrated.slice(0, 60);
  const lines = [
    '# Difficulty Evaluation',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'This is a heuristic calibration pass using `tools/acquisition/difficulty-rules.mjs`, the same difficulty logic used during intake. It should be treated as an editorial queue, not as truth. Real attempt data should eventually override these estimates.',
    '',
    '## Summary',
    '',
    `- Active questions evaluated: ${summary.total_active}`,
    `- Calibrated: ${summary.overall.calibrated}`,
    `- Possibly overrated: ${summary.overall.possibly_overrated}`,
    `- Likely overrated: ${summary.overall.likely_overrated}`,
    `- Possibly underrated: ${summary.overall.possibly_underrated}`,
    `- Likely underrated: ${summary.overall.likely_underrated}`,
    '',
    '## By Current Value',
    '',
    '| Current Value | Count | Calibrated | Possibly Over | Likely Over | Possibly Under | Likely Under | Avg Suggested |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary.by_current_value).map(([value, item]) => `| $${value} | ${item.count} | ${item.calibrated} | ${item.possibly_overrated} | ${item.likely_overrated} | ${item.possibly_underrated} | ${item.likely_underrated} | $${item.average_suggested_value} |`),
    '',
    '## Likely Overrated Samples',
    '',
    '| Current | Suggested | Confidence | Reasons | Clue | Answer |',
    '| ---: | ---: | ---: | --- | --- | --- |',
    ...over.map((row) => `| $${row.current_value} | $${row.suggested_value} | ${row.confidence} | ${row.reasons.slice(0, 4).join(', ')} | ${escapeCell(row.clue)} | ${escapeCell(row.answer)} |`),
    '',
    '## Likely Underrated Samples',
    '',
    '| Current | Suggested | Confidence | Reasons | Clue | Answer |',
    '| ---: | ---: | ---: | --- | --- | --- |',
    ...under.map((row) => `| $${row.current_value} | $${row.suggested_value} | ${row.confidence} | ${row.reasons.slice(0, 4).join(', ')} | ${escapeCell(row.clue)} | ${escapeCell(row.answer)} |`),
    '',
    'Full machine-readable results: `data/acquisition/difficulty-evaluation.json`',
    '',
  ];

  return `${lines.join('\n')}`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}
