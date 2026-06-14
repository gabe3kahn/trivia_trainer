import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const mapPath = path.join(__dirname, 'opentdb-map.json');
const rawDir = path.join(rootDir, 'data', 'acquisition', 'raw');
const normalizedDir = path.join(rootDir, 'data', 'acquisition', 'normalized');

const args = parseArgs(process.argv.slice(2));
const amount = Number(args.amount ?? 50);
const category = args.category ? Number(args.category) : null;
const difficulty = args.difficulty ?? null;
const type = args.type ?? null;
const label = args.label ?? timestampLabel();

if (!Number.isInteger(amount) || amount < 1 || amount > 50) {
  throw new Error('--amount must be an integer from 1 to 50.');
}

const providerMap = JSON.parse(await fs.readFile(mapPath, 'utf8'));
const url = new URL('https://opentdb.com/api.php');
url.searchParams.set('amount', String(amount));
url.searchParams.set('encode', 'url3986');
if (category) url.searchParams.set('category', String(category));
if (difficulty) url.searchParams.set('difficulty', difficulty);
if (type) url.searchParams.set('type', type);

console.log(`Fetching ${url.toString()}`);
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`OpenTDB request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
if (payload.response_code !== 0) {
  throw new Error(`OpenTDB response_code=${payload.response_code}. See planning/data-sources.md for provider notes.`);
}

await fs.mkdir(rawDir, { recursive: true });
await fs.mkdir(normalizedDir, { recursive: true });

const rawPath = path.join(rawDir, `opentdb-${label}.json`);
const normalizedPath = path.join(normalizedDir, `opentdb-${label}.json`);

await fs.writeFile(rawPath, JSON.stringify({
  fetched_at: new Date().toISOString(),
  request_url: url.toString(),
  provider: 'opentdb',
  payload,
}, null, 2));

const normalized = payload.results.map((item) => normalizeQuestion(item, providerMap));
await fs.writeFile(normalizedPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  provider: 'opentdb',
  source_url: providerMap.source_url,
  license: providerMap.license,
  notes: [
    'Imported provider text; not rewritten into Jeopardy style.',
    'Keep attribution fields if this content is stored or redistributed.'
  ],
  questions: normalized,
}, null, 2));

console.log(`Wrote ${rawPath}`);
console.log(`Wrote ${normalizedPath}`);
console.log(`Normalized ${normalized.length} questions.`);

function normalizeQuestion(item, providerMap) {
  const providerCategory = decodeProviderText(item.category);
  const mapped = providerMap.categories[providerCategory];
  if (!mapped) {
    throw new Error(`No taxonomy mapping for OpenTDB category "${providerCategory}".`);
  }

  const difficulty = providerMap.difficulty[item.difficulty];
  if (!difficulty) {
    throw new Error(`No difficulty mapping for OpenTDB difficulty "${item.difficulty}".`);
  }

  const clue = decodeProviderText(item.question);
  const answer = decodeProviderText(item.correct_answer);
  const incorrectAnswers = item.incorrect_answers.map(decodeProviderText);
  const externalId = crypto
    .createHash('sha1')
    .update(`${providerCategory}|${clue}|${answer}`)
    .digest('hex')
    .slice(0, 16);

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
    distractors: incorrectAnswers,
    tags: [...new Set(['opentdb', ...mapped.tags, item.difficulty, item.type])],
    review_status: 'needs_review'
  };
}

function decodeProviderText(value) {
  const decoded = decodeURIComponent(value);
  return decoded
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
