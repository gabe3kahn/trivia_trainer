/**
 * Stage 3 — build the source-document corpus for a category.
 *
 * Reads the flat topic pool (data/sourcing/topics/pool.json), selects topics whose
 * SUBJECT keywords match --keywords, ranks them by how often they appear in real
 * Jeopardy clues, and for the top topics fetches authoritative reference text + a
 * citation from Wikipedia. These docs are the verified source material clues are
 * written FROM. --category only sets the output folder + the doc's category_id; the
 * topics themselves come from the keyword-filtered pool (a topic can serve several
 * categories), so drafting music pulls music-tagged topics regardless of where the
 * Jeopardy game filed them.
 *
 * Idempotent + incremental: skips topics that already have a doc, bounded per run (--limit).
 *
 * Usage:
 *   node tools/acquisition/build-topic-docs.mjs --category music_performing_arts \
 *     --keywords "music,composer,opera,song,band,jazz,broadway" --limit 25
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const category = args.category ?? 'geography';
const limit = Number(args.limit ?? 40);
const minCount = Number(args.minCount ?? 1);
const delayMs = Number(args.delayMs ?? 600);
// Topics are selected from the flat pool by SUBJECT keywords (see keyword-topics.mjs),
// not from a per-category store. Pass the keywords relevant to what you're drafting;
// a topic matches if any of its tags hits one of these.
const keywords = String(args.keywords ?? '')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const root = process.cwd();
const poolPath = path.join(root, 'data', 'sourcing', 'topics', 'pool.json');
const docsDir = path.join(root, 'data', 'sourcing', 'docs', category);
await fs.mkdir(docsDir, { recursive: true });

const pool = await readJson(poolPath);
if (!pool) {
  console.error(`No topic pool at ${poolPath}. Run build-topic-pool.mjs (after the harvester).`);
  process.exit(1);
}

// Exact tag match (tolerating a trailing plural 's'), NOT substring — else short
// tags like "art" would hit "quartet"/"earth"/"Mozart".
const want = new Set(keywords.flatMap((q) => [q, q.endsWith('s') ? q.slice(0, -1) : `${q}s`]));
const matchesKeywords = (t) => keywords.length === 0 || (t.keywords ?? []).some((k) => want.has(k));

// Rank topics by real-clue frequency; filter to the requested keywords and skip
// non-topical answers (numbers, very short/generic tokens) that don't source well.
const ranked = Object.values(pool.topics ?? {})
  .filter((t) => t.count >= minCount && isTopical(t.display) && matchesKeywords(t))
  .sort((a, b) => b.count - a.count);

const fetchJson = makeFetchJson();
let fetched = 0;
let skippedExisting = 0;
let failed = 0;

console.log(`Building docs for "${category}" — ${ranked.length} candidate topics, fetching up to ${limit} new.\n`);

for (const topic of ranked) {
  if (fetched >= limit) break;
  const slug = slugify(topic.display);
  const docPath = path.join(docsDir, `${slug}.json`);
  if (await exists(docPath)) {
    skippedExisting += 1;
    continue;
  }

  try {
    const doc = await buildDoc(topic, category);
    if (!doc) {
      failed += 1;
      console.log(`  MISS  ${topic.display} (no source found)`);
    } else {
      await writeJson(docPath, doc);
      fetched += 1;
      console.log(`  OK    ${topic.display}  ←  ${doc.title} (${doc.extract.length} chars)`);
    }
  } catch (error) {
    failed += 1;
    console.log(`  ERR   ${topic.display}: ${error.message}`);
  }
  await wait(delayMs);
}

console.log(`\nFetched ${fetched} new doc(s), skipped ${skippedExisting} existing, ${failed} without a clean source.`);
console.log(`Corpus: data/sourcing/docs/${category}/`);

/* ------------------------------------------------------------------ */

async function buildDoc(topic, categoryId) {
  const answer = topic.display;
  // Resolve the canonical Wikipedia page (direct REST first, search fallback).
  let summary = await wikiSummary(answer);
  if (!summary || summary.type === 'disambiguation' || !summary.extract) {
    const title = await wikiSearchTopTitle(answer);
    summary = title ? await wikiSummary(title) : null;
  }
  if (!summary || !summary.extract) return null;

  // Richer lead-section extract for authoring grounding.
  const extract = (await wikiLeadExtract(summary.title)) || summary.extract;

  return {
    topic: answer,
    category_id: categoryId,
    clue_frequency: topic.count,
    seen_at_values: topic.values ?? [],
    source: 'wikipedia',
    title: summary.title,
    url: summary.url,
    retrieved_at: new Date().toISOString(),
    summary: summary.extract,
    extract,
    citation: { source: 'wikipedia', title: summary.title, url: summary.url },
  };
}

async function wikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
  const data = await fetchJson(url);
  if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
  return {
    title: data.title ?? title,
    extract: data.extract ?? '',
    type: data.type ?? 'standard',
    url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`,
  };
}

async function wikiSearchTopTitle(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  return data?.query?.search?.[0]?.title ?? null;
}

async function wikiLeadExtract(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  return page?.extract ? String(page.extract).trim() : null;
}

function isTopical(answer) {
  const a = String(answer ?? '').trim();
  if (a.length < 3) return false;
  if (/^\d+([.,]\d+)?$/.test(a)) return false; // bare numbers
  if (/^(yes|no|true|false|gray|grey|red|blue|green|two|three|ten)$/i.test(a)) return false;
  return true;
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

function makeFetchJson() {
  return async function fetchJson(url, attempt = 0) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TriviaTrainerDocBuilder/0.1 (personal study app)', Accept: 'application/json' },
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
  };
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
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
