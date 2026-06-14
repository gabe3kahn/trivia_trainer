import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { chooseCalibratedValue, valueToRank } from './difficulty-rules.mjs';

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const report = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'acquisition', 'difficulty-evaluation.json'), 'utf8'));
const candidates = report.all
  .map((row) => ({
    ...row,
    next_value: chooseCalibratedValue({ ...row, value: row.current_value }, row),
  }))
  .filter((row) => row.next_value && row.next_value !== row.current_value);

const updates = [];

for (const row of candidates) {
  await request(`/rest/v1/questions?id=eq.${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      value: row.next_value,
      difficulty_rank: valueToRank(row.next_value),
    }),
    headers: { Prefer: 'return=minimal' },
  });

  updates.push({
    id: row.id,
    category_id: row.category_id,
    clue: row.clue,
    answer: row.answer,
    previous_value: row.current_value,
    next_value: row.next_value,
    verdict: row.verdict,
    confidence: row.confidence,
    reasons: row.reasons,
  });
}

const output = {
  generated_at: new Date().toISOString(),
  count: updates.length,
  lowered: updates.filter((row) => row.next_value < row.previous_value).length,
  raised: updates.filter((row) => row.next_value > row.previous_value).length,
  updates,
};

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `difficulty-calibration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify(output, null, 2));

console.log(`Applied ${updates.length} difficulty changes.`);
console.log(`Lowered: ${output.lowered}`);
console.log(`Raised: ${output.raised}`);
console.log(`Report: ${reportPath}`);
