// Merge the harvested per-category topic stores into ONE flat topic pool.
//
// The per-category split (and the Jeopardy category TITLES) were misleading — most
// titles are puns, and a topic legitimately spans domains. The pool drops both: it's
// just "what Jeopardy actually asks about," keyed by answer, with frequency + an
// example clue. Relevance for drafting comes from LLM-added keywords (keyword-topics.mjs),
// not from a rigid bucket.
//
//   node tools/acquisition/build-topic-pool.mjs
//
// Idempotent: preserves any keywords already attached to a topic in the existing pool.

import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const topicsDir = path.join(root, 'data', 'sourcing', 'topics');
const poolPath = path.join(topicsDir, 'pool.json');

const existing = await readJson(poolPath);
const prevKeywords = new Map(
  Object.values(existing?.topics ?? {}).map((t) => [t.display.toLowerCase(), t.keywords ?? []]),
);

const files = (await fs.readdir(topicsDir)).filter((f) => f.endsWith('.json') && f !== 'pool.json');
const pool = {};
let merged = 0;

for (const file of files) {
  const store = await readJson(path.join(topicsDir, file));
  for (const a of Object.values(store?.answers ?? {})) {
    merged += 1;
    const key = a.display.toLowerCase();
    const entry = (pool[key] ??= {
      display: a.display,
      count: 0,
      values: [],
      example_clue: a.example_clue ?? '',
      keywords: prevKeywords.get(key) ?? [],
    });
    entry.count += a.count ?? 0;
    entry.values = [...new Set([...entry.values, ...(a.values ?? [])])].sort((x, y) => x - y);
    if (!entry.example_clue && a.example_clue) entry.example_clue = a.example_clue;
  }
}

const out = {
  updated_at: new Date().toISOString(),
  topic_count: Object.keys(pool).length,
  topics: pool,
};
await fs.writeFile(poolPath, JSON.stringify(out, null, 2));

const withKw = Object.values(pool).filter((t) => (t.keywords ?? []).length).length;
console.log(`Merged ${merged} answer rows from ${files.length} stores → ${out.topic_count} distinct topics.`);
console.log(`  ${withKw} already keyworded, ${out.topic_count - withKw} need keywords (run keyword-topics.mjs).`);
console.log(`Wrote ${poolPath}`);

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
