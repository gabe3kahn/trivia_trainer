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
 * Two-phase fetch: (1) resolve each topic's canonical title via the per-title
 * rest_v1 summary (unthrottled), then (2) pull the rich lead extracts for ALL
 * resolved titles in BATCHES of 20 (Action API `extracts`, exlimit=max). The
 * per-title extract call is the one Wikipedia rate-limits hard; batching cuts it
 * ~20x and avoids the 429-backoff stalls that made cloud runs crawl.
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

// Phase 1 — resolve each topic's canonical title via the per-title summary
// (rest_v1; unthrottled). Collect up to `limit` NEW docs to build.
const pending = [];
for (const topic of ranked) {
  if (pending.length >= limit) break;
  const slug = slugify(topic.display);
  const docPath = path.join(docsDir, `${slug}.json`);
  if (await exists(docPath)) {
    skippedExisting += 1;
    continue;
  }
  try {
    const resolved = await resolveTopic(topic);
    if (!resolved) {
      failed += 1;
      console.log(`  MISS  ${topic.display} (no source found)`);
    } else {
      pending.push({ topic, docPath, ...resolved });
    }
  } catch (error) {
    failed += 1;
    console.log(`  ERR   ${topic.display}: ${error.message}`);
  }
  await wait(delayMs);
}

// Phase 2 — batch-fetch the rich lead extracts for all resolved titles at once
// (20/request, exlimit=max). This is the call Wikipedia rate-limits when made
// one title at a time; batching cuts it ~20x and dodges the 429-backoff stalls.
const extractMap = await wikiBatchExtracts(pending.map((p) => p.title));

// Phase 3 — assemble + write docs (extract falls back to the summary if a batch
// entry is missing).
for (const p of pending) {
  const extract = extractMap.get(normTitle(p.title)) || p.summaryExtract;
  const doc = {
    topic: p.topic.display,
    category_id: category,
    clue_frequency: p.topic.count,
    seen_at_values: p.topic.values ?? [],
    source: 'wikipedia',
    title: p.title,
    url: p.url,
    summary: p.summaryExtract,
    extract,
    citation: { source: 'wikipedia', title: p.title, url: p.url },
  };
  await writeJson(p.docPath, doc);
  fetched += 1;
  console.log(`  OK    ${p.topic.display}  ←  ${p.title} (${extract.length} chars)`);
}

console.log(`\nFetched ${fetched} new doc(s), skipped ${skippedExisting} existing, ${failed} without a clean source.`);
console.log(`Corpus: data/sourcing/docs/${category}/`);

/* ------------------------------------------------------------------ */

async function resolveTopic(topic) {
  const answer = topic.display;
  // Resolve the canonical Wikipedia page (direct REST first, search fallback).
  let summary = await wikiSummary(answer);
  if (!summary || summary.type === 'disambiguation' || !summary.extract) {
    const title = await wikiSearchTopTitle(answer);
    summary = title ? await wikiSummary(title) : null;
  }
  if (!summary || !summary.extract) return null;
  return { title: summary.title, url: summary.url, summaryExtract: summary.extract };
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

// Fetch lead-section extracts for many titles at once. The Action API caps
// `extracts` at 20 titles per request even with exlimit=max, so chunk by 20.
// Returns Map(normTitle -> extract), resolving the API's normalized/redirect
// title chains so a requested title still finds its page.
async function wikiBatchExtracts(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&exlimit=max&redirects=1&titles=${encodeURIComponent(chunk.join('|'))}`;
    const data = await fetchJson(url);
    const query = data?.query;
    if (query) {
      const alias = new Map(); // normalized/redirect: requested -> resolved
      for (const n of query.normalized ?? []) alias.set(normTitle(n.from), n.to);
      for (const r of query.redirects ?? []) alias.set(normTitle(r.from), r.to);
      const byTitle = new Map();
      for (const page of Object.values(query.pages ?? {})) {
        if (page.extract) byTitle.set(normTitle(page.title), String(page.extract).trim());
      }
      for (const requested of chunk) {
        let current = requested;
        for (let hops = 0; alias.has(normTitle(current)) && hops < 5; hops += 1) current = alias.get(normTitle(current));
        const extract = byTitle.get(normTitle(current)) || byTitle.get(normTitle(requested));
        if (extract) out.set(normTitle(requested), extract);
      }
    }
    if (i + 20 < titles.length) await wait(delayMs);
  }
  return out;
}

function isTopical(answer) {
  const a = String(answer ?? '').trim();
  if (a.length < 3) return false;
  if (/^\d+([.,]\d+)?$/.test(a)) return false; // bare numbers
  if (/^(yes|no|true|false|gray|grey|red|blue|green|two|three|ten)$/i.test(a)) return false;
  return true;
}

// Normalize a Wikipedia title for matching: underscores→spaces, collapse, lowercase.
function normTitle(value) {
  return String(value ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
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
