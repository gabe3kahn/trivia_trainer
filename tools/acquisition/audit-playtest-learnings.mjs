import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { auditPlaytestLearnings } from './playtest-learning-rules.mjs';

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(
  request,
  '/rest/v1/questions?select=id,source,external_id,category_id,categories(name),subcategory_id,subcategories(name),value,difficulty_rank,mechanic,constraint_text,clue,answer,aliases,tags,quality_status,quality_score,quality_issues,is_active&is_active=eq.true',
);

const audited = rows
  .map((row) => ({ ...row, playtest: auditPlaytestLearnings(row) }))
  .filter((row) => row.playtest.issues.length > 0)
  .toSorted((a, b) => b.playtest.severity - a.playtest.severity || a.category_id.localeCompare(b.category_id));

const summary = {
  generated_at: new Date().toISOString(),
  total_active: rows.length,
  flagged_total: audited.length,
  auto_fixable: audited.filter((row) => row.playtest.fixes).length,
  issue_counts: issueCounts(audited),
  by_category: summarizeBy(audited, (row) => row.category_id),
  flagged: audited.map((row) => ({
    id: row.id,
    source: row.source,
    external_id: row.external_id,
    category_id: row.category_id,
    category_name: row.categories?.name ?? row.category_id,
    subcategory_name: row.subcategories?.name ?? null,
    value: row.value,
    difficulty_rank: row.difficulty_rank,
    severity: row.playtest.severity,
    issues: row.playtest.issues,
    fixes: row.playtest.fixes,
    clue: row.clue,
    answer: row.answer,
    aliases: row.aliases,
    tags: row.tags,
  })),
};

await fs.mkdir(path.join(process.cwd(), 'data', 'acquisition'), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'playtest-learning-audit.json'),
  JSON.stringify(summary, null, 2),
);
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'playtest-learning-audit.md'),
  renderMarkdown(summary),
);

console.log(`Audited ${rows.length} active questions for playtest learnings.`);
console.log(`Flagged: ${summary.flagged_total}`);
console.log(`Auto-fixable: ${summary.auto_fixable}`);
console.log(`Top issues: ${Object.entries(summary.issue_counts).slice(0, 5).map(([key, count]) => `${key}=${count}`).join(', ')}`);

function issueCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const issue of item.playtest.issues) {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function summarizeBy(items, keyFn) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    groups[key] ??= { count: 0, auto_fixable: 0 };
    groups[key].count += 1;
    if (item.playtest.fixes) groups[key].auto_fixable += 1;
  }
  return Object.fromEntries(Object.entries(groups).sort());
}

function renderMarkdown(summary) {
  const rows = summary.flagged.slice(0, 120);
  const lines = [
    '# Playtest Learning Audit',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'This audit generalizes recent playtest feedback: low-value exact album/subtype recall, overly narrow card-type answers, duplicate rewrite phrases, long specialist answers at beginner values, and cases where a short common answer form may be preferable.',
    '',
    '## Summary',
    '',
    `- Active questions checked: ${summary.total_active}`,
    `- Flagged suspects: ${summary.flagged_total}`,
    `- Auto-fixable: ${summary.auto_fixable}`,
    '',
    '## Issue Counts',
    '',
    '| Issue | Count |',
    '| --- | ---: |',
    ...Object.entries(summary.issue_counts).map(([issue, count]) => `| ${issue} | ${count} |`),
    '',
    '## Highest Priority Suspects',
    '',
    '| Severity | Auto | Category | Value | Issues | Clue | Answer | Fix |',
    '| ---: | --- | --- | ---: | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.severity} | ${row.fixes ? 'yes' : 'no'} | ${row.category_id} | ${row.value} | ${row.issues.map((issue) => issue.code).join(', ')} | ${escapeCell(row.clue)} | ${escapeCell(row.answer)} | ${escapeCell(renderFix(row.fixes))} |`),
    '',
    'Full machine-readable results: `data/acquisition/playtest-learning-audit.json`',
    '',
  ];

  return `${lines.join('\n')}`;
}

function renderFix(fixes) {
  if (!fixes) return '';
  return Object.entries(fixes)
    .filter(([key]) => key !== 'quality_issues')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('; ') : value}`)
    .join(', ');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}
