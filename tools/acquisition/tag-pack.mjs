#!/usr/bin/env node
/**
 * Stamp topic_entities onto every clue in a draft pack, so the tags are an EXPLICIT,
 * reviewable part of the draft (visible in the PR diff, curatable by hand) rather than
 * silently recomputed. The critic reads these when checking a draft clue against the bank
 * for RELATED clues; the importer persists them (migration 036).
 *
 * Tags are LLM-generated (Haiku, via topic-entities.mjs → the shared llm-batch component) so
 * they capture the subject's canonical associations (Mona Lisa → da Vinci, Louvre, Renaissance)
 * — not just words the clue happens to contain. If the LLM is unavailable / returns nothing for
 * a clue, it falls back to the deterministic regex extractor. Run it after authoring a pack
 * (drafter step 6c), before the critic + dry-run. A clue that already carries a curated
 * `topic_entities` is LEFT ALONE unless --force.
 *
 *   node tools/acquisition/tag-pack.mjs <pack.json> [<pack.json> …] [--force]
 */
import fs from 'node:fs';
import { extractTopicEntities, llmTagEntities, normalizeEntities } from './topic-entities.mjs';

const force = process.argv.includes('--force');
const packs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!packs.length) { console.error('usage: tag-pack.mjs <pack.json> [<pack.json> …] [--force]'); process.exit(1); }

for (const p of packs) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const questions = data.questions || data;
  const todo = questions.filter((q) => force || !(Array.isArray(q.topic_entities) && q.topic_entities.length));
  if (!todo.length) { console.log(`${p}: all ${questions.length} clue(s) already tagged`); continue; }

  const tags = await llmTagEntities(todo.map((q) => ({ id: q.external_id || q.answer, answer: q.answer, clue: q.clue })));
  let llm = 0;
  let fell = 0;
  for (const q of todo) {
    let ent = tags.get(String(q.external_id || q.answer));
    if (ent && ent.length) llm += 1;
    else { ent = normalizeEntities(extractTopicEntities(q.answer, q.clue)); fell += 1; } // offline fallback
    q.topic_entities = ent;
  }
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${p}: tagged ${todo.length}/${questions.length} (${llm} via LLM, ${fell} via fallback)`);
}
