/**
 * Seed the Geography doc corpus with "obvious candidate" entity sets — the
 * canonical universe a geography bank should obviously cover, regardless of what
 * the J! Archive harvester has surfaced yet.
 *
 *   - Every (independent) country          -> Countries & Borders
 *   - Every world capital                  -> World Capitals      (both via restcountries API)
 *   - All 50 U.S. states                   -> U.S. States & Cities
 *   - 20 longest rivers                    -> Rivers, Lakes & Seas
 *   - 5 oceans + major seas                -> Rivers, Lakes & Seas
 *   - 20 largest lakes                     -> Rivers, Lakes & Seas
 *   - 10 major mountain ranges             -> Mountains & Deserts
 *   - Globally famous national parks       -> Landmarks & UNESCO Sites
 *
 * For each entity it fetches a cited Wikipedia lead extract into
 * data/sourcing/docs/geography/<slug>.json (same shape build-topic-docs uses),
 * skipping any doc that already exists. Idempotent + resumable, so it's safe to
 * run in the background and re-run.
 *
 * Note: "most visited national parks in the world" has no clean public dataset,
 * so the park set is a curated list of globally prominent parks, flagged as such.
 *
 * Usage: node tools/acquisition/seed-geography-candidates.mjs [--limit N] [--delayMs 500]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const limit = args.limit ? Number(args.limit) : Infinity;
const delayMs = Number(args.delayMs ?? 500);

const root = process.cwd();
const docsDir = path.join(root, 'data', 'sourcing', 'docs', 'geography');
const seedsDir = path.join(root, 'data', 'sourcing', 'seeds');
await fs.mkdir(docsDir, { recursive: true });
await fs.mkdir(seedsDir, { recursive: true });

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida',
  'Georgia (U.S. state)', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska',
  'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York (state)', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Washington (state)', 'West Virginia', 'Wisconsin', 'Wyoming',
];

const RIVERS = [
  'Nile', 'Amazon River', 'Yangtze', 'Mississippi River', 'Yenisei', 'Yellow River', 'Ob River', 'Paraná River',
  'Congo River', 'Amur River', 'Lena River', 'Mekong', 'Mackenzie River', 'Niger River', 'Brahmaputra River',
  'Murray River', 'Volga', 'Indus River', 'Danube', 'Tigris',
];

const OCEANS = ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Southern Ocean', 'Arctic Ocean'];

const SEAS = [
  'Mediterranean Sea', 'Caribbean Sea', 'South China Sea', 'Red Sea', 'Black Sea', 'Baltic Sea', 'North Sea',
  'Arabian Sea', 'Bering Sea', 'Sea of Japan', 'Coral Sea', 'Tasman Sea', 'Andaman Sea', 'Sea of Okhotsk',
  'Adriatic Sea', 'Aegean Sea',
];

const LAKES = [
  'Caspian Sea', 'Lake Superior', 'Lake Victoria', 'Lake Huron', 'Lake Michigan', 'Lake Tanganyika', 'Lake Baikal',
  'Great Bear Lake', 'Lake Malawi', 'Great Slave Lake', 'Lake Erie', 'Lake Winnipeg', 'Lake Ontario', 'Lake Ladoga',
  'Lake Balkhash', 'Lake Vostok', 'Lake Onega', 'Lake Titicaca', 'Lake Nicaragua', 'Lake Athabasca',
];

const RANGES = [
  'Andes', 'Himalayas', 'Rocky Mountains', 'Alps', 'Ural Mountains', 'Atlas Mountains', 'Appalachian Mountains',
  'Great Dividing Range', 'Transantarctic Mountains', 'Hindu Kush',
];

const PARKS = [
  'Yellowstone National Park', 'Yosemite National Park', 'Grand Canyon National Park', 'Great Smoky Mountains National Park',
  'Zion National Park', 'Rocky Mountain National Park', 'Acadia National Park', 'Grand Teton National Park',
  'Glacier National Park (U.S.)', 'Olympic National Park', 'Denali National Park and Preserve', 'Everglades National Park',
  'Banff National Park', 'Jasper National Park', 'Kruger National Park', 'Serengeti National Park',
  'Galápagos National Park', 'Plitvice Lakes National Park', 'Torres del Paine National Park', 'Fiordland National Park',
  'Tongariro National Park', 'Iguazú National Park', 'Komodo National Park', 'Sagarmatha National Park',
  'Kakadu National Park', 'Etosha National Park', 'Chitwan National Park', 'Jim Corbett National Park',
  'Lake District National Park', 'Snowdonia',
];

// Build the full candidate list (countries + capitals come from a live API).
const candidates = [];
const seen = new Set();
const add = (entity, subcategory_name, theme) => {
  const key = `${entity}`.toLowerCase();
  if (!entity || seen.has(key)) return;
  seen.add(key);
  candidates.push({ entity, subcategory_name, theme });
};

try {
  // UN member states + their capitals from Wikidata (P463 = member of, Q1065 =
  // United Nations; P36 = capital). Authoritative and free; restcountries v3.1
  // was deprecated.
  const sparql =
    'SELECT ?cLabel ?capLabel WHERE { ?c wdt:P463 wd:Q1065 . OPTIONAL { ?c wdt:P36 ?cap. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }';
  const data = await fetchJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`);
  const rows = data?.results?.bindings ?? [];
  const before = candidates.length;
  for (const row of rows) {
    add(row.cLabel?.value, 'Countries & Borders', 'country');
    if (row.capLabel?.value) add(row.capLabel.value, 'World Capitals', 'capital');
  }
  console.log(`Wikidata: ${rows.length} rows → ${candidates.length - before} country/capital candidates.`);
} catch (error) {
  console.log(`Wikidata countries query failed (${error.message}); seeding curated sets only.`);
}

for (const s of US_STATES) add(s, 'U.S. States & Cities', 'us-state');
for (const r of RIVERS) add(r, 'Rivers, Lakes & Seas', 'river');
for (const o of OCEANS) add(o, 'Rivers, Lakes & Seas', 'ocean');
for (const s of SEAS) add(s, 'Rivers, Lakes & Seas', 'sea');
for (const l of LAKES) add(l, 'Rivers, Lakes & Seas', 'lake');
for (const m of RANGES) add(m, 'Mountains & Deserts', 'mountain-range');
for (const p of PARKS) add(p, 'Landmarks & UNESCO Sites', 'national-park');

console.log(`\n${candidates.length} candidate topics across ${new Set(candidates.map((c) => c.theme)).size} themes.\n`);

let fetched = 0;
let skipped = 0;
let missed = 0;
const manifest = [];

for (const cand of candidates) {
  if (fetched >= limit) break;
  const slug = slugify(cand.entity);
  const docPath = path.join(docsDir, `${slug}.json`);
  if (await exists(docPath)) {
    skipped += 1;
    manifest.push({ ...cand, slug, status: 'exists' });
    continue;
  }
  try {
    const doc = await fetchWikiDoc(cand.entity);
    if (!doc) {
      missed += 1;
      manifest.push({ ...cand, slug, status: 'no-source' });
      console.log(`  MISS  ${cand.entity}`);
    } else {
      await writeJson(docPath, {
        topic: cand.entity,
        category_id: 'geography',
        subcategory_name: cand.subcategory_name,
        theme: cand.theme,
        seed: true,
        source: 'wikipedia',
        title: doc.title,
        url: doc.url,
        extract: doc.extract,
        citation: { source: 'wikipedia', title: doc.title, url: doc.url },
      });
      fetched += 1;
      manifest.push({ ...cand, slug, status: 'fetched', title: doc.title });
      if (fetched % 25 === 0) console.log(`  …${fetched} fetched`);
    }
  } catch (error) {
    missed += 1;
    manifest.push({ ...cand, slug, status: `error:${error.message}` });
  }
  await wait(delayMs);
}

await writeJson(path.join(seedsDir, 'geography-candidates.json'), {
  generated_at: new Date().toISOString(),
  total_candidates: candidates.length,
  fetched,
  skipped_existing: skipped,
  missed,
  note: 'National parks are a curated globally-prominent set, not a strict visitation ranking.',
  candidates: manifest,
});

console.log(`\nSeed complete: ${fetched} new docs, ${skipped} already existed, ${missed} without a clean source.`);
console.log(`Corpus: data/sourcing/docs/geography/  |  manifest: data/sourcing/seeds/geography-candidates.json`);

/* ------------------------------------------------------------------ */

async function fetchWikiDoc(entity) {
  // One-call lead extract via the action API (resolves redirects). Search
  // fallback if the title doesn't resolve to a real page.
  let resolved = await actionExtract(entity);
  if (!resolved) {
    const title = await searchTopTitle(entity);
    resolved = title ? await actionExtract(title) : null;
  }
  if (!resolved || !resolved.extract || resolved.extract.length < 120) return null;
  return resolved;
}

async function actionExtract(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.extract) return null;
  return {
    title: page.title,
    extract: String(page.extract).trim(),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`,
  };
}

async function searchTopTitle(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  return data?.query?.search?.[0]?.title ?? null;
}

async function fetchJson(url, attempt = 0) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TriviaTrainerGeoSeeder/0.1 (personal study app)', Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1);
    await wait(backoff);
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
