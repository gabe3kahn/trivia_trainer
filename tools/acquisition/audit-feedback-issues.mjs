import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { auditFeedbackIssues } from './feedback-quality-rules.mjs';

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(
  request,
  '/rest/v1/questions?select=id,source,category_id,categories(name),subcategories(name),value,difficulty_rank,mechanic,constraint_text,clue,answer,aliases,tags,quality_status&is_active=eq.true',
);

const audited = rows
  .map((row) => ({ ...row, feedback: auditFeedbackIssues(row) }))
  .filter((row) => row.feedback.issues.length > 0)
  .toSorted((a, b) => b.feedback.severity - a.feedback.severity || a.category_id.localeCompare(b.category_id));

const summary = {
  generated_at: new Date().toISOString(),
  total_active: rows.length,
  flagged_total: audited.length,
  high_priority: audited.filter((row) => row.feedback.severity >= 8).length,
  medium_priority: audited.filter((row) => row.feedback.severity >= 4 && row.feedback.severity < 8).length,
  low_priority: audited.filter((row) => row.feedback.severity < 4).length,
  issue_counts: issueCounts(audited),
  by_category: summarizeBy(audited, (row) => row.category_id),
  flagged: audited.map((row) => ({
    id: row.id,
    source: row.source,
    category_id: row.category_id,
    category_name: row.categories?.name ?? row.category_id,
    subcategory_name: row.subcategories?.name ?? null,
    value: row.value,
    difficulty_rank: row.difficulty_rank,
    mechanic: row.mechanic,
    severity: row.feedback.severity,
    issues: row.feedback.issues,
    notes: row.feedback.notes,
    clue: row.clue,
    answer: row.answer,
    aliases: row.aliases,
    tags: row.tags,
  })),
};

await fs.mkdir(path.join(process.cwd(), 'data', 'acquisition'), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'feedback-issue-audit.json'),
  JSON.stringify(summary, null, 2),
);
await fs.writeFile(
  path.join(process.cwd(), 'data', 'acquisition', 'feedback-issue-audit.md'),
  renderMarkdown(summary),
);

console.log(`Audited ${rows.length} active questions for feedback-shaped issues.`);
console.log(`Flagged: ${summary.flagged_total}`);
console.log(`High priority: ${summary.high_priority}`);
console.log(`Medium priority: ${summary.medium_priority}`);
console.log(`Low priority: ${summary.low_priority}`);

function issueCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const issue of item.feedback.issues) {
      counts[issue] = (counts[issue] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function summarizeBy(items, keyFn) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    groups[key] ??= { count: 0, high: 0, medium: 0, low: 0 };
    groups[key].count += 1;
    if (item.feedback.severity >= 8) groups[key].high += 1;
    else if (item.feedback.severity >= 4) groups[key].medium += 1;
    else groups[key].low += 1;
  }
  return Object.fromEntries(Object.entries(groups).sort());
}

function renderMarkdown(summary) {
  const rows = summary.flagged.slice(0, 120);
  const lines = [
    '# Feedback Issue Audit',
    '',
    `Generated: ${summary.generated_at}`,
    '',
    'This audit uses `tools/acquisition/feedback-quality-rules.mjs`, the same feedback-shaped checks used by intake. It looks for Moore-law-style ambiguity around ellipses, units, and numerical answer forms; and Statue-of-Liberty-style leakage where a meaningful word from the answer appears in the clue.',
    '',
    '## Summary',
    '',
    `- Active questions checked: ${summary.total_active}`,
    `- Flagged suspects: ${summary.flagged_total}`,
    `- High priority: ${summary.high_priority}`,
    `- Medium priority: ${summary.medium_priority}`,
    `- Low priority: ${summary.low_priority}`,
    '',
    '## Issue Counts',
    '',
    '| Issue | Count |',
    '| --- | ---: |',
    ...Object.entries(summary.issue_counts).map(([issue, count]) => `| ${issue} | ${count} |`),
    '',
    '## Highest Priority Suspects',
    '',
    '| Severity | Issue | Category | Value | Clue | Answer |',
    '| ---: | --- | --- | ---: | --- | --- |',
    ...rows.map((row) => `| ${row.severity} | ${row.issues.join(', ')} | ${row.category_id} | ${row.value} | ${escapeCell(row.clue)} | ${escapeCell(row.answer)} |`),
    '',
    'Full machine-readable results: `data/acquisition/feedback-issue-audit.json`',
    '',
  ];

  return `${lines.join('\n')}`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}
