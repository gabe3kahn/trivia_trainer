import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseRequest, formatDifficultyCounts, formatQualityCounts, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { assessQuestionForIntake } from './intake-assessment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const mapPath = path.join(__dirname, 'opentdb-map.json');
const normalizedDir = path.join(rootDir, 'data', 'acquisition', 'normalized');
const summaryDir = path.join(rootDir, 'data', 'acquisition');

await loadDefaultEnv(rootDir);

const args = parseArgs(process.argv.slice(2));
const target = Number(args.target ?? 100);
const maxCalls = Number(args.maxCalls ?? 80);
const dryRun = Boolean(args.dryRun ?? args['dry-run']);
const label = args.label ?? timestampLabel();

const supabaseRequest = createSupabaseRequest(getSupabaseAdminConfig());

const providerMap = JSON.parse(await fs.readFile(mapPath, 'utf8'));
const subcategories = await supabaseRequest('/rest/v1/subcategories?select=id,category_id,name');
const subcategoryByName = new Map(subcategories.map((item) => [`${item.category_id}|${item.name}`, item.id]));
const categories = await supabaseRequest('/rest/v1/categories?select=id,name&order=sort_order.asc');
const counts = await fetchCategoryCounts();

const providerPlan = [
  { id: 10, name: 'Entertainment: Books', main: 'literature_books' },
  { id: 23, name: 'History', main: 'history' },
  { id: 24, name: 'Politics', main: 'history' },
  { id: 22, name: 'Geography', main: 'geography' },
  { id: 17, name: 'Science & Nature', main: 'science' },
  { id: 18, name: 'Science: Computers', main: 'science' },
  { id: 19, name: 'Science: Mathematics', main: 'science' },
  { id: 27, name: 'Animals', main: 'science' },
  { id: 25, name: 'Art', main: 'arts_visual_culture' },
  { id: 12, name: 'Entertainment: Music', main: 'music_performing_arts' },
  { id: 13, name: 'Entertainment: Musicals & Theatres', main: 'music_performing_arts' },
  { id: 20, name: 'Mythology', main: 'religion_mythology_philosophy' },
  { id: 21, name: 'Sports', main: 'sports_games_leisure' },
  { id: 15, name: 'Entertainment: Video Games', main: 'sports_games_leisure' },
  { id: 16, name: 'Entertainment: Board Games', main: 'sports_games_leisure' },
  { id: 9, name: 'General Knowledge', main: 'pop_culture_media_modern_life' },
  { id: 11, name: 'Entertainment: Film', main: 'pop_culture_media_modern_life' },
  { id: 14, name: 'Entertainment: Television', main: 'pop_culture_media_modern_life' },
  { id: 26, name: 'Celebrities', main: 'pop_culture_media_modern_life' },
  { id: 28, name: 'Vehicles', main: 'pop_culture_media_modern_life' },
  { id: 29, name: 'Entertainment: Comics', main: 'pop_culture_media_modern_life' },
  { id: 30, name: 'Science: Gadgets', main: 'pop_culture_media_modern_life' },
  { id: 31, name: 'Entertainment: Japanese Anime & Manga', main: 'pop_culture_media_modern_life' },
  { id: 32, name: 'Entertainment: Cartoon & Animations', main: 'pop_culture_media_modern_life' },
];

const token = await getToken();
const exhaustedProviderIds = new Set();
const importedQuestions = [];
const callLog = [];
const qualityCounts = {};
const difficultyCounts = {};
let calls = 0;

console.log(`Starting OpenTDB fill toward ${target} per main category.${dryRun ? ' Dry run only.' : ''}`);
printCounts(counts);

while (calls < maxCalls) {
  const deficits = categories
    .map((category) => ({
      ...category,
      count: counts[category.id] ?? 0,
      deficit: target - (counts[category.id] ?? 0),
      providers: providerPlan.filter((provider) => provider.main === category.id && !exhaustedProviderIds.has(provider.id)),
    }))
    .filter((category) => category.deficit > 0 && category.providers.length > 0)
    .sort((a, b) => b.deficit - a.deficit);

  if (!deficits.length) break;

  const category = deficits[0];
  const provider = category.providers[calls % category.providers.length];
  const amount = Math.min(50, category.deficit);

  calls += 1;
  console.log(`\n[${calls}/${maxCalls}] ${category.id}: need ${category.deficit}. Fetching ${amount} from ${provider.name}.`);
  const result = await fetchOpenTdb({ amount, categoryId: provider.id, token });
  callLog.push({ category_id: category.id, provider: provider.name, requested: amount, response_code: result.response_code, received: result.results?.length ?? 0 });

  if (result.response_code === 4 || result.response_code === 1) {
    console.log(`Provider exhausted/no results: ${provider.name}`);
    exhaustedProviderIds.add(provider.id);
    await waitForRateLimit();
    continue;
  }

  if (result.response_code !== 0) {
    console.log(`Skipping provider response_code=${result.response_code}`);
    await waitForRateLimit();
    continue;
  }

  const normalized = result.results.map((item) => normalizeQuestion(item, providerMap));
  let changed = 0;

  for (const question of normalized) {
    const outcome = await importQuestion(question, { dryRun });
    if (outcome.action !== 'updated' && outcome.active) {
      counts[question.category_id] = (counts[question.category_id] ?? 0) + 1;
      changed += 1;
    }
    importedQuestions.push({
      ...question,
      quality_status: outcome.quality.decision,
      quality_score: outcome.quality.score,
      quality_issues: outcome.quality.issues,
      is_active: outcome.active,
    });
  }

  console.log(`${dryRun ? 'Would import' : 'Imported'} ${changed} active likely-new questions. ${category.id} now ${counts[category.id] ?? 0}/${target}.`);
  console.log(`Quality gate so far: ${formatQualityCounts(qualityCounts)}`);
  await waitForRateLimit();
}

await fs.mkdir(normalizedDir, { recursive: true });
await fs.mkdir(summaryDir, { recursive: true });

const normalizedPath = path.join(normalizedDir, `opentdb-fill-${label}.json`);
const summaryPath = path.join(summaryDir, `opentdb-fill-${label}-summary.json`);
await fs.writeFile(normalizedPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  provider: 'opentdb',
  target_per_main_category: target,
  dry_run: dryRun,
  questions: importedQuestions,
}, null, 2));
await fs.writeFile(summaryPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  target_per_main_category: target,
  dry_run: dryRun,
  calls,
  counts,
  exhausted_provider_ids: [...exhaustedProviderIds],
  call_log: callLog,
  quality_counts: qualityCounts,
  difficulty_counts: difficultyCounts,
}, null, 2));

console.log('\nFinal estimated counts:');
printCounts(counts);
console.log(`Difficulty calibration: ${formatDifficultyCounts(difficultyCounts)}`);
console.log(`Wrote ${normalizedPath}`);
console.log(`Wrote ${summaryPath}`);

async function fetchCategoryCounts() {
  const rows = await supabaseRequest('/rest/v1/questions?select=category_id&is_active=eq.true&limit=10000');
  return rows.reduce((acc, row) => {
    acc[row.category_id] = (acc[row.category_id] ?? 0) + 1;
    return acc;
  }, {});
}

async function importQuestion(question, { dryRun }) {
  const subcategoryId = subcategoryByName.get(`${question.category_id}|${question.subcategory_name}`);
  if (!subcategoryId) throw new Error(`No subcategory for ${question.category_id} / ${question.subcategory_name}.`);

  const { prepared, quality, active, difficulty } = assessQuestionForIntake(question);
  qualityCounts[quality.decision] = (qualityCounts[quality.decision] ?? 0) + 1;
  if (difficulty.applied_value !== question.value) {
    const key = `$${question.value}->$${difficulty.applied_value}`;
    difficultyCounts[key] = (difficultyCounts[key] ?? 0) + 1;
  }

  if (dryRun) return { action: 'inserted', active, quality };

  const existing = await supabaseRequest(
    `/rest/v1/questions?select=id&source=eq.${encodeURIComponent(question.source)}&external_id=eq.${encodeURIComponent(question.external_id)}&limit=1`,
  );
  const payload = {
    source: prepared.source,
    source_url: prepared.source_url ?? null,
    external_id: prepared.external_id,
    category_id: prepared.category_id,
    subcategory_id: subcategoryId,
    value: prepared.value,
    difficulty_rank: prepared.difficulty_rank,
    mechanic: prepared.mechanic,
    constraint_text: prepared.constraint_text ?? null,
    clue: prepared.clue,
    answer: prepared.answer,
    aliases: prepared.aliases ?? [],
    tags: prepared.tags ?? [],
    quality_status: quality.decision,
    quality_score: quality.score,
    quality_issues: quality.issues,
    is_active: active,
  };

  if (existing.length) {
    await supabaseRequest(`/rest/v1/questions?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=minimal' },
    });
    return { action: 'updated', active, quality };
  }

  await supabaseRequest('/rest/v1/questions', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Prefer: 'return=minimal' },
  });
  return { action: 'inserted', active, quality };
}

async function fetchOpenTdb({ amount, categoryId, token }) {
  const url = new URL('https://opentdb.com/api.php');
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('category', String(categoryId));
  url.searchParams.set('encode', 'url3986');
  if (token) url.searchParams.set('token', token);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenTDB failed: ${response.status}`);
  return response.json();
}

async function getToken() {
  try {
    const response = await fetch('https://opentdb.com/api_token.php?command=request');
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.response_code === 0 ? payload.token : null;
  } catch {
    return null;
  }
}

function normalizeQuestion(item, providerMap) {
  const providerCategory = decodeProviderText(item.category);
  const mapped = providerMap.categories[providerCategory];
  if (!mapped) throw new Error(`No mapping for "${providerCategory}".`);

  const difficulty = providerMap.difficulty[item.difficulty];
  const clue = decodeProviderText(item.question);
  const answer = decodeProviderText(item.correct_answer);
  const externalId = crypto.createHash('sha1').update(`${providerCategory}|${clue}|${answer}`).digest('hex').slice(0, 16);

  return {
    source: 'opentdb',
    source_url: providerMap.source_url,
    source_license: providerMap.license,
    external_id: `opentdb-${externalId}`,
    provider_category: providerCategory,
    provider_difficulty: item.difficulty,
    provider_type: item.type,
    category_id: mapped.category_id,
    subcategory_name: mapped.subcategory_name,
    value: difficulty.value,
    difficulty_rank: difficulty.difficulty_rank,
    mechanic: 'standard',
    constraint_text: null,
    clue,
    answer,
    aliases: [],
    distractors: item.incorrect_answers.map(decodeProviderText),
    tags: [...new Set(['opentdb', ...mapped.tags, item.difficulty, item.type])],
    review_status: 'needs_review',
  };
}

function decodeProviderText(value) {
  return decodeURIComponent(value)
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'e')
    .replace(/&uuml;/g, 'u')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .trim();
}

function printCounts(counts) {
  for (const category of categories) {
    console.log(`${category.id}: ${counts[category.id] ?? 0}/${target}`);
  }
}

function waitForRateLimit() {
  return new Promise((resolve) => setTimeout(resolve, 5250));
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1]?.startsWith('--') ? true : argv[index + 1] ?? true;
    parsed[key] = value;
    if (value !== true) index += 1;
  }
  return parsed;
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
