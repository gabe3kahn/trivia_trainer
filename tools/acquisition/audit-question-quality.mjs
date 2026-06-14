import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { auditQuestion } from './question-quality-rules.mjs';

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(
  request,
  '/rest/v1/questions?select=id,source,category_id,categories(name),subcategory_id,subcategories(name),value,mechanic,constraint_text,clue,answer,aliases,tags,is_active&is_active=eq.true',
);

const audited = rows
  .map((row) => ({ ...row, quality: auditQuestion(row) }))
  .toSorted((a, b) => a.quality.score - b.quality.score || a.category_id.localeCompare(b.category_id));

const flagged = audited.filter((row) => row.quality.decision !== 'keep');
const summary = {
  generated_at: new Date().toISOString(),
  total_active: audited.length,
  overall: summarize(audited),
  by_category: summarizeBy(audited, (row) => row.category_id),
  by_source: summarizeBy(audited, (row) => row.source),
  issue_counts: issueCounts(flagged),
  flagged: flagged.map((row) => ({
    id: row.id,
    source: row.source,
    category_id: row.category_id,
    category_name: row.categories?.name ?? row.category_id,
    subcategory_name: row.subcategories?.name ?? null,
    value: row.value,
    mechanic: row.mechanic,
    score: row.quality.score,
    decision: row.quality.decision,
    issues: row.quality.issues,
    clue: row.clue,
    answer: row.answer,
    aliases: row.aliases,
    tags: row.tags,
  })),
};

await fs.mkdir(path.join(process.cwd(), 'data', 'acquisition'), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'question-quality-audit.json'),
  JSON.stringify(summary, null, 2),
);
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'question-quality-review.md'),
  renderMarkdown(summary),
);

console.log(`Audited ${audited.length} active questions.`);
console.log(`Keep: ${summary.overall.keep}`);
console.log(`Needs rewrite: ${summary.overall.rewrite}`);
console.log(`Consider replacing: ${summary.overall.replace}`);
console.log(`Deactivate: ${summary.overall.deactivate}`);

function summarize(items) {
  const total = items.length;
  return {
    count: total,
    average_score: total ? Math.round(items.reduce((sum, row) => sum + row.quality.score, 0) / total) : 0,
    keep: items.filter((row) => row.quality.decision === 'keep').length,
    rewrite: items.filter((row) => row.quality.decision === 'rewrite').length,
    replace: items.filter((row) => row.quality.decision === 'replace').length,
    deactivate: items.filter((row) => row.quality.decision === 'deactivate').length,
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

function issueCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const issue of item.quality.issues) {
      counts[issue] = (counts[issue] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function renderMarkdown(summary) {
  const topRows = summary.flagged.slice(0, 80);
  const lines = [
    '# Question Quality Review',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'This is a stricter editorial pass than the Jeopardy-style audit. It flags clues that may be declarative but still confusing, overly converted from quiz-question syntax, dependent on hidden multiple-choice options, too thin, too jargony, or unclear about the expected answer type.',
    '',
    '## Summary',
    '',
    '| Decision | Count |',
    '| --- | ---: |',
    `| Keep | ${summary.overall.keep} |`,
    `| Rewrite | ${summary.overall.rewrite} |`,
    `| Replace | ${summary.overall.replace} |`,
    `| Deactivate | ${summary.overall.deactivate} |`,
    '',
    '## By Category',
    '',
    '| Category | Count | Avg | Keep | Rewrite | Replace | Deactivate |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary.by_category).map(([key, value]) => `| ${key} | ${value.count} | ${value.average_score} | ${value.keep} | ${value.rewrite} | ${value.replace} | ${value.deactivate} |`),
    '',
    '## Main Issue Counts',
    '',
    '| Issue | Count |',
    '| --- | ---: |',
    ...Object.entries(summary.issue_counts).slice(0, 20).map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Highest Priority Flagged Clues',
    '',
    '| Decision | Score | Category | Value | Issue | Clue | Answer |',
    '| --- | ---: | --- | ---: | --- | --- | --- |',
    ...topRows.map((row) => `| ${row.decision} | ${row.score} | ${row.category_id} | ${row.value} | ${row.issues.slice(0, 3).join(', ')} | ${escapeCell(row.clue)} | ${escapeCell(row.answer)} |`),
    '',
    'Full machine-readable results: `data/acquisition/question-quality-audit.json`',
    '',
  ];
  return `${lines.join('\n')}`;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}
