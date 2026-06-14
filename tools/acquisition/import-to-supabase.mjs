import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseRequest, formatDifficultyCounts, formatQualityCounts, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { assessQuestionForIntake } from './intake-assessment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

await loadDefaultEnv(rootDir);

const bankPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!bankPath) {
  throw new Error('Usage: node tools/acquisition/import-to-supabase.mjs <normalized-question-bank.json> [--dry-run]');
}

const request = createSupabaseRequest(getSupabaseAdminConfig());

const bank = JSON.parse(await fs.readFile(path.resolve(bankPath), 'utf8'));
const questions = Array.isArray(bank) ? bank : bank.questions;
if (!Array.isArray(questions)) {
  throw new Error('Question bank must be an array or an object with a questions array.');
}

const subcategories = await request('/rest/v1/subcategories?select=id,category_id,name');
const subcategoryByName = new Map(
  subcategories.map((subcategory) => [`${subcategory.category_id}|${subcategory.name}`, subcategory.id]),
);

let inserted = 0;
let updated = 0;
let skipped = 0;
const qualityCounts = {};
const difficultyCounts = {};

for (const question of questions) {
  const subcategoryId = subcategoryByName.get(`${question.category_id}|${question.subcategory_name}`);
  if (!subcategoryId) {
    throw new Error(`No subcategory found for ${question.category_id} / ${question.subcategory_name}.`);
  }

  const { prepared, quality, active, difficulty } = assessQuestionForIntake(question);
  qualityCounts[quality.decision] = (qualityCounts[quality.decision] ?? 0) + 1;
  if (difficulty.applied_value !== question.value) {
    const key = `$${question.value}->$${difficulty.applied_value}`;
    difficultyCounts[key] = (difficultyCounts[key] ?? 0) + 1;
  }

  const payload = {
    source: prepared.source,
    source_url: prepared.source_url ?? null,
    external_id: prepared.external_id,
    category_id: prepared.category_id,
    subcategory_id: subcategoryId,
    value: prepared.value,
    difficulty_rank: prepared.difficulty_rank,
    mechanic: prepared.mechanic ?? 'standard',
    constraint_text: prepared.constraint_text ?? null,
    clue: prepared.clue,
    answer: prepared.answer,
    aliases: prepared.aliases ?? [],
    tags: prepared.tags ?? [],
    quality_status: quality.decision,
    quality_score: quality.score,
    quality_issues: quality.issues,
    citations: question.citations ?? [],
    verification_status: question.verification_status ?? 'unverified',
    verified_at: question.verified_at ?? null,
    is_active: active,
  };

  if (dryRun) {
    skipped += 1;
    continue;
  }

  const existing = await request(
    `/rest/v1/questions?select=id&source=eq.${encodeURIComponent(question.source)}&external_id=eq.${encodeURIComponent(question.external_id)}&limit=1`,
  );

  if (existing.length) {
    await request(`/rest/v1/questions?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=minimal' },
    });
    updated += 1;
  } else {
    await request('/rest/v1/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=minimal' },
    });
    inserted += 1;
  }
}

console.log(dryRun ? `Dry run OK for ${skipped} questions.` : `Imported ${inserted} inserted, ${updated} updated.`);
console.log(`Quality gate: ${formatQualityCounts(qualityCounts)}`);
console.log(`Difficulty calibration: ${formatDifficultyCounts(difficultyCounts)}`);
