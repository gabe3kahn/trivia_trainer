#!/usr/bin/env node
/**
 * Backfill questions.topic_entities over the ACTIVE bank (migration 036), so the critic's
 * advisory `related` check has stored tags to compare against. Tags are LLM-generated (Haiku,
 * via topic-entities.mjs → the shared llm-batch component) — the subject's canonical
 * associations (Mona Lisa → da Vinci, Louvre, Renaissance), not just clue-text tokens.
 *
 * Incremental + resumable, exactly like keyword-topics.mjs: only clues that still lack tags
 * are processed, in batches, PATCHed per batch — so re-running continues where it left off,
 * and --limit bounds a run's budget. Prod write — run it after applying 036.
 *
 *   node tools/acquisition/backfill-topic-entities.mjs [--dry-run] [--limit N] [--batch N]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { llmTagEntities } from './topic-entities.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
await loadDefaultEnv(rootDir);
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : Infinity;
const batchSize = argv.includes('--batch') ? Number(argv[argv.indexOf('--batch') + 1]) : 40;
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(request, '/rest/v1/questions?select=id,external_id,answer,clue,topic_entities&is_active=eq.true');
const pending = rows.filter((r) => !(Array.isArray(r.topic_entities) && r.topic_entities.length));
const todo = pending.slice(0, Number.isFinite(limit) ? limit : pending.length);
console.log(`${pending.length} active clue(s) need tags; doing ${todo.length} this run (batch ${batchSize}${dryRun ? ', DRY RUN' : ''}).`);

const idToRow = new Map(todo.map((r) => [r.external_id, r]));
let wrote = 0;
await llmTagEntities(
  todo.map((r) => ({ id: r.external_id, answer: r.answer, clue: r.clue })),
  {
    batchSize,
    onBatch: async ({ index, batches, tagged }) => {
      for (const t of tagged) {
        const row = idToRow.get(String(t.id));
        if (!row) continue;
        if (dryRun) { if (wrote < 15) console.log(`  would set ${t.id} → [${t.topic_entities.join(', ')}]`); wrote += 1; continue; }
        await request(`/rest/v1/questions?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ topic_entities: t.topic_entities }),
          headers: { Prefer: 'return=minimal' },
        });
        wrote += 1;
      }
      console.log(`  batch ${index}/${batches}: ${dryRun ? 'previewed' : 'wrote'} ${tagged.length} (total ${wrote})`);
    },
  },
);
console.log(`${dryRun ? '[dry-run] ' : ''}topic_entities: ${wrote} clue(s) ${dryRun ? 'would be' : ''} tagged (of ${pending.length} pending). Re-run to continue the rest.`);
