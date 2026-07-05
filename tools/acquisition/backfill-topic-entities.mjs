#!/usr/bin/env node
/**
 * Backfill questions.topic_entities over the ACTIVE bank (migration 036), so the critic's
 * advisory `related` check has stored, curatable tags to compare against (rather than
 * recomputing every run). Idempotent: only PATCHes rows whose stored tags differ from the
 * freshly-computed set, so it's safe to re-run. Prod write — run it once after applying 036.
 *
 *   node tools/acquisition/backfill-topic-entities.mjs [--dry-run]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseRequest, fetchAllSupabaseRows, getSupabaseAdminConfig, loadDefaultEnv } from './acquisition-utils.mjs';
import { extractTopicEntities } from './topic-entities.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
await loadDefaultEnv(rootDir);
const dryRun = process.argv.includes('--dry-run');
const request = createSupabaseRequest(getSupabaseAdminConfig());

const rows = await fetchAllSupabaseRows(request, '/rest/v1/questions?select=id,external_id,answer,clue,topic_entities&is_active=eq.true');
const same = (a, b) => { a = a || []; b = b || []; return a.length === b.length && a.every((x, i) => x === b[i]); };

let updated = 0;
let unchanged = 0;
for (const r of rows) {
  const ent = extractTopicEntities(r.answer, r.clue);
  if (same(ent, r.topic_entities)) { unchanged += 1; continue; }
  updated += 1;
  if (dryRun) { if (updated <= 12) console.log(`  would set ${r.external_id} → [${ent.join(', ')}]`); continue; }
  await request(`/rest/v1/questions?id=eq.${r.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ topic_entities: ent }),
    headers: { Prefer: 'return=minimal' },
  });
}
console.log(`${dryRun ? '[dry-run] ' : ''}topic_entities: ${updated} to update, ${unchanged} already current (of ${rows.length} active clues).`);
