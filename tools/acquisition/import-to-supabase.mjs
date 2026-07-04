import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseRequest, fetchAllSupabaseRows, formatDifficultyCounts, formatQualityCounts, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
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

// Hard gate: no two clues in a pack may share an answer. The drafter prompt asks
// for distinct answers, but the model has shipped duplicates anyway (taiga ×2,
// Mark Twain ×2, …), so enforce it here — this fails the dry-run gate too, so a
// duplicate-laden pack can't reach a PR or an import.
const normAnswer = (a) =>
  String(a ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const answerCounts = new Map();
for (const question of questions) {
  const key = normAnswer(question.answer);
  if (!key) continue;
  answerCounts.set(key, (answerCounts.get(key) ?? 0) + 1);
}
const duplicateAnswers = [...answerCounts.entries()].filter(([, n]) => n > 1);
if (duplicateAnswers.length) {
  throw new Error(
    `Duplicate answers in pack — each clue must have a unique answer. Repeated: ${duplicateAnswers
      .map(([a, n]) => `"${a}" ×${n}`)
      .join(', ')}`,
  );
}

// Hard gate #2: no pack answer may duplicate one already ACTIVE in the bank under a
// DIFFERENT clue (the cross-run/cross-category collisions — e.g. re-drafting "Bob Fosse").
// The drafter is told to check category-coverage, but that's advisory; enforce it here so a
// re-drafted live answer fails the dry-run instead of slipping into a PR on review alone.
// Re-importing the SAME pack stays safe: a live row carrying one of this pack's own
// external_ids is excluded (that's an update of this clue, not a collision).
//
// SCOPED BY CLASS: two clues only collide when they're the same KIND of question.
//  - Wordplay class: a constructed-wordplay answer (category language_wordplay) and a
//    normal answer can be the same word — "Muscle" the homophone is a different KIND
//    from "Muscle" the body part.
//  - Image class: an image clue ("name the artist/painting/flag" off a picture) and a
//    text clue with the same answer test different things — recognition vs recall — so
//    they may coexist (applies to artists, paintings, flags, …). Two image clues, or
//    two text clues, with the same answer ARE a wasted repeat.
// A collision counts only when BOTH the wordplay-ness AND the image-ness match.
const WORDPLAY_CATEGORY = 'language_wordplay';
const isWordplay = (categoryId) => categoryId === WORDPLAY_CATEGORY;
const isImage = (q) => Boolean(q.image_url);
const packExternalIds = new Set(questions.map((q) => q.external_id).filter(Boolean));
const activeRows = await fetchAllSupabaseRows(
  request,
  '/rest/v1/questions?select=answer,aliases,external_id,category_id,image_url&is_active=eq.true',
);
// A clue is identified for dedup by ANY of its acceptable answers — the primary
// plus every alias. Index and compare on all of them so a draft collides even when
// its primary answer matches a live clue's ALIAS or vice versa (e.g. draft primary
// "Absolute pitch" vs a live "Perfect pitch" whose alias is "Absolute pitch" — the
// answer-only gate missed these).
const answerKeys = (row) => {
  const keys = new Set();
  for (const value of [row.answer, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
    const key = normAnswer(value);
    if (key) keys.add(key);
  }
  return keys;
};
const activeByAnswer = new Map();
for (const row of activeRows) {
  for (const key of answerKeys(row)) {
    if (!activeByAnswer.has(key)) activeByAnswer.set(key, []);
    activeByAnswer.get(key).push(row);
  }
}
const bankCollisions = [];
for (const question of questions) {
  // Reviewer-blessed cross-fact dupe (e.g. "Brazil" as a geography fact AND a World Cup
  // fact). The gate is answer-only, so it can't tell different facts apart — allow_duplicate
  // is the manual override that says "this shared answer is intentional, not a re-draft".
  if (question.allow_duplicate === true) continue;
  const packWordplay = isWordplay(question.category_id);
  const packImage = isImage(question);
  const seen = new Set();
  const hits = [];
  for (const key of answerKeys(question)) {
    for (const row of activeByAnswer.get(key) ?? []) {
      if (packExternalIds.has(row.external_id) || seen.has(row.external_id)) continue;
      if (isWordplay(row.category_id) !== packWordplay || isImage(row) !== packImage) continue;
      seen.add(row.external_id);
      hits.push(row);
    }
  }
  if (hits.length) bankCollisions.push(`"${question.answer}" (already active as ${hits[0].external_id})`);
}
if (bankCollisions.length) {
  throw new Error(
    `Answers already active in the bank under a same-class clue — re-drafting a live answer is a ` +
      `wasted repeat (run category-coverage and swap them). Collisions: ${bankCollisions.join(', ')}`,
  );
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
    image_url: question.image_url ?? null,
    image_attribution: question.image_attribution ?? null,
    image_license: question.image_license ?? null,
    answer_detail: question.answer_detail ?? null,
    answer_type: question.answer_type === 'name' ? 'name' : 'other', // default safe; only people are 'name'
    allow_duplicate: question.allow_duplicate === true, // reviewer-blessed cross-fact dupe (skips the dedup gate)
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
