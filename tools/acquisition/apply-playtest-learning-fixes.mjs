import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';

await loadDefaultEnv();
const request = createSupabaseRequest(getSupabaseAdminConfig());

const report = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'acquisition', 'playtest-learning-audit.json'), 'utf8'));
const candidates = report.flagged.filter((row) => row.fixes);
const updates = [];

for (const row of candidates) {
  const patch = { ...row.fixes };
  await request(`/rest/v1/questions?id=eq.${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: { Prefer: 'return=representation' },
  });

  updates.push({
    id: row.id,
    external_id: row.external_id,
    category_id: row.category_id,
    previous: {
      clue: row.clue,
      answer: row.answer,
      aliases: row.aliases,
      value: row.value,
      difficulty_rank: row.difficulty_rank,
    },
    patch,
    issues: row.issues.map((issue) => issue.code),
  });
}

const output = {
  generated_at: new Date().toISOString(),
  count: updates.length,
  updates,
};

const reportPath = path.join(
  process.cwd(),
  'data',
  'acquisition',
  `playtest-learning-fixes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(reportPath, JSON.stringify(output, null, 2));

console.log(`Applied ${updates.length} playtest-learning fixes.`);
console.log(`Report: ${reportPath}`);
