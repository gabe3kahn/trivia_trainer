/**
 * Verify a normalized question pack's answers against reputable sources and
 * record citations. Triage layer before import — anything not corroborated is
 * flagged for human review rather than trusted.
 *
 * Usage:
 *   node tools/acquisition/verify-clue-sources.mjs --pack data/acquisition/normalized/strategy-pack-001.json
 *   node tools/acquisition/verify-clue-sources.mjs --pack <path> --limit 25 --delayMs 300
 *
 * Writes data/acquisition/source-verification-<label>.{json,md}. The JSON
 * carries a `citations` array per question, ready to persist once the schema
 * has a citations column (see migration plan).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { verifyAnswer } from './source-verifier.mjs';

const args = parseArgs(process.argv.slice(2));
const fromDb = Boolean(args['from-db'] ?? args.fromDb);
const writeBack = Boolean(args['write-back'] ?? args.writeBack);
const packPath = args.pack ?? 'data/acquisition/normalized/strategy-pack-001.json';
const limit = args.limit ? Number(args.limit) : Infinity;
const delayMs = Number(args.delayMs ?? 350);

let questions;
let sourceLabel;
let raw = null; // the full pack object, for --write-back
if (fromDb) {
  await loadDefaultEnv(process.cwd());
  const request = createSupabaseRequest(getSupabaseAdminConfig());
  const rows = await fetchAllSupabaseRows(
    request,
    '/rest/v1/questions?select=id,source,category_id,subcategories(name),value,mechanic,clue,answer,aliases,tags&is_active=eq.true',
  );
  questions = rows.slice(0, limit).map((row) => ({
    id: row.id,
    source: row.source,
    category_id: row.category_id,
    subcategory_name: row.subcategories?.name ?? null,
    value: row.value,
    mechanic: row.mechanic,
    clue: row.clue,
    answer: row.answer,
    aliases: row.aliases ?? [],
    tags: row.tags ?? [],
  }));
  sourceLabel = 'live active bank';
} else {
  raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), packPath), 'utf8'));
  questions = (raw.questions ?? []).slice(0, limit);
  sourceLabel = packPath;
}

const label = args.label ?? (fromDb ? 'live-bank' : path.basename(packPath).replace(/\.json$/, ''));

const fetchJson = makeFetchJson();
const results = [];
const counts = { verified: 0, weak: 0, unverified: 0, skipped: 0 };
const bySource = {}; // source -> {verified,weak,unverified,skipped,total}

console.log(`Verifying ${questions.length} clue(s) from ${sourceLabel} against reputable sources…\n`);

for (let i = 0; i < questions.length; i += 1) {
  const q = questions[i];
  let verdict;
  try {
    verdict = await verifyAnswer(q, { fetchJson });
  } catch (error) {
    verdict = { status: 'unverified', confidence: 0, citations: [], note: `error:${error.message}` };
  }
  counts[verdict.status] = (counts[verdict.status] ?? 0) + 1;
  const provenance = q.source ?? 'unknown';
  bySource[provenance] ??= { verified: 0, weak: 0, unverified: 0, skipped: 0, total: 0 };
  bySource[provenance][verdict.status] += 1;
  bySource[provenance].total += 1;

  results.push({
    id: q.id ?? null,
    question_source: q.source ?? null,
    category_id: q.category_id,
    value: q.value,
    clue: q.clue,
    answer: q.answer,
    status: verdict.status,
    confidence: verdict.confidence,
    verified_via: verdict.source ?? null,
    note: verdict.note ?? null,
    citations: verdict.citations ?? [],
  });

  if (writeBack && !fromDb) {
    q.citations = verdict.citations ?? [];
    q.verification_status = verdict.status;
    q.verified_at = new Date().toISOString();
  }

  const tag = verdict.status.toUpperCase().padEnd(10);
  console.log(`${tag} [${String(verdict.confidence ?? '-').padStart(4)}] ${q.answer}  ${verdict.citations?.[0]?.url ?? ''}`);
  if (delayMs > 0 && i < questions.length - 1) await wait(delayMs);
}

const summary = {
  generated_at: new Date().toISOString(),
  source: sourceLabel,
  total: results.length,
  counts,
  by_source: bySource,
  results,
};

const outDir = path.join(process.cwd(), 'data', 'acquisition');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `source-verification-${label}.json`), JSON.stringify(summary, null, 2));
await fs.writeFile(path.join(outDir, `source-verification-${label}.md`), renderMarkdown(summary));

const checked = counts.verified + counts.weak + counts.unverified;
console.log(`\nVerified ${counts.verified}/${checked} (${pct(counts.verified, checked)}%), weak ${counts.weak}, unverified ${counts.unverified}, skipped ${counts.skipped}.`);
console.log(`Wrote data/acquisition/source-verification-${label}.{json,md}`);

if (writeBack && raw) {
  await fs.writeFile(path.resolve(process.cwd(), packPath), JSON.stringify(raw, null, 2));
  console.log(`Wrote citations + verification_status back into ${packPath}`);
}

function renderMarkdown(s) {
  const flagged = s.results.filter((r) => r.status === 'unverified' || r.status === 'weak');
  return [
    '# Source Verification',
    '',
    `Generated: ${s.generated_at}`,
    `Pack: \`${s.pack}\``,
    '',
    `Each answer was looked up in a reputable source (Wikipedia; Wiktionary for definitions) and the clue's content words were checked against that source. \`verified\` = corroborated with a citation; \`weak\`/\`unverified\` = needs a human eye; \`skipped\` = constructed wordplay (not a factual lookup).`,
    '',
    '## Summary',
    '',
    '| Status | Count |',
    '| --- | ---: |',
    ...Object.entries(s.counts).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## By Source (provenance)',
    '',
    '| Source | Total | Verified | Weak | Unverified | Skipped | % verified |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(s.by_source ?? {})
      .sort((a, b) => b[1].total - a[1].total)
      .map(([src, c]) => `| ${src} | ${c.total} | ${c.verified} | ${c.weak} | ${c.unverified} | ${c.skipped} | ${pct(c.verified, c.total)}% |`),
    '',
    '## Flagged for review (weak / unverified)',
    '',
    '| Status | Conf | Answer | Clue | Citation |',
    '| --- | ---: | --- | --- | --- |',
    ...flagged.map(
      (r) => `| ${r.status} | ${r.confidence ?? '-'} | ${cell(r.answer)} | ${cell(r.clue)} | ${cell(r.citations?.[0]?.url ?? '')} |`,
    ),
    '',
    'Full machine-readable results (with citations per clue): the matching `.json`.',
    '',
  ].join('\n');
}

function cell(v) {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function pct(n, d) {
  return d ? Math.round((n / d) * 100) : 0;
}

function makeFetchJson() {
  return async function fetchJson(url, attempt = 0) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TriviaTrainerSourceVerifier/0.1 (personal study app; contact: local)',
        Accept: 'application/json',
      },
    });
    if (response.status === 404) return null;
    // Back off and retry on rate-limit / transient server errors.
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
