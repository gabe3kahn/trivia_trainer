// Tag pool topics with subject keywords via a small LLM (Haiku), so the drafter can
// search the pool by domain. Keywords come from the ANSWER + its example clue — never
// the (punny) Jeopardy category title. A topic may span domains; we keep all that apply.
//
//   node tools/acquisition/keyword-topics.mjs               # keyword all un-keyworded topics
//   node tools/acquisition/keyword-topics.mjs --limit 80    # only N this run (testing / budget)
//   node tools/acquisition/keyword-topics.mjs --batch 40    # topics per LLM call (default 40)
//
// Incremental + resumable: writes pool.json back after every batch, and skips topics that
// already have keywords. Built on the shared llm-batch component (same batched-Claude
// foundation as the clue topic-entity tagger).

import fs from 'node:fs/promises';
import path from 'node:path';
import { batchClassify } from './llm-batch.mjs';

const args = parseArgs(process.argv.slice(2));
const limit = args.limit ? Number(args.limit) : Infinity;
const batchSize = Number(args.batch ?? 40);
const model = String(args.model ?? 'claude-haiku-4-5');

const root = process.cwd();
const poolPath = path.join(root, 'data', 'sourcing', 'topics', 'pool.json');
const pool = JSON.parse(await fs.readFile(poolPath, 'utf8'));

const pending = Object.values(pool.topics).filter((t) => !(t.keywords?.length));
const todo = pending.slice(0, Number.isFinite(limit) ? limit : pending.length);
console.log(`${pending.length} topics need keywords; doing ${todo.length} this run (batch ${batchSize}, ${model}).`);

let done = 0;
await batchClassify({
  items: todo,
  batchSize,
  model,
  buildPrompt: (batch) => {
    const list = batch.map((t) => `- ${t.display} — "${(t.example_clue || '').replace(/"/g, "'").slice(0, 220)}"`).join('\n');
    return `For each trivia topic below (answer — example clue), output 4-8 lowercase subject keywords/tags capturing what the topic is ABOUT, for indexing. A topic can span multiple domains — include every domain that applies (e.g. a country may get geography, history, and religion). Use the answer and clue, NOT any category name. Output ONLY a JSON object mapping each answer (verbatim, exactly as written) to its keyword array — no prose, no code fences.\n\nTopics:\n${list}`;
  },
  onBatch: async ({ index, batches, batch, parsed }) => {
    for (const t of batch) {
      const kw = parsed[t.display] ?? parsed[t.display.toLowerCase()];
      if (Array.isArray(kw) && kw.length) {
        t.keywords = [...new Set(kw.map((k) => String(k).toLowerCase().trim()).filter(Boolean))].slice(0, 8);
        done += 1;
      }
    }
    pool.updated_at = new Date().toISOString();
    await fs.writeFile(poolPath, JSON.stringify(pool, null, 2)); // persist progress per batch
    console.log(`  batch ${index}/${batches}: keyworded ${batch.filter((t) => t.keywords?.length).length}/${batch.length} (total ${done})`);
  },
});
console.log(`Done. Keyworded ${done} topics. ${Object.values(pool.topics).filter((t) => !(t.keywords?.length)).length} still pending.`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const val = argv[i + 1]?.startsWith('--') ? true : argv[i + 1] ?? true;
    parsed[key] = val;
    if (val !== true) i += 1;
  }
  return parsed;
}
