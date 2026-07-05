#!/usr/bin/env node
/**
 * Stamp topic_entities onto every clue in a draft pack, so the tags are an EXPLICIT,
 * reviewable part of the draft (visible in the PR diff, curatable by hand) rather than
 * silently recomputed. The critic reads these when checking a draft clue against the bank
 * for RELATED clues; the importer persists them (migration 036). Same deterministic
 * extraction the backfill uses, so draft / DB / import all share one tag set.
 *
 * Run it after authoring a pack (drafter step), before the critic + dry-run. Idempotent.
 * A clue that already carries a curated `topic_entities` is LEFT ALONE unless --force.
 *
 *   node tools/acquisition/tag-pack.mjs <pack.json> [<pack.json> …] [--force]
 */
import fs from 'node:fs';
import { extractTopicEntities } from './topic-entities.mjs';

const force = process.argv.includes('--force');
const packs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!packs.length) { console.error('usage: tag-pack.mjs <pack.json> [<pack.json> …] [--force]'); process.exit(1); }

for (const p of packs) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const questions = data.questions || data;
  let tagged = 0;
  for (const q of questions) {
    if (!force && Array.isArray(q.topic_entities) && q.topic_entities.length) continue; // keep curated tags
    q.topic_entities = extractTopicEntities(q.answer, q.clue);
    tagged += 1;
  }
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${p}: stamped topic_entities on ${tagged}/${questions.length} clue(s)`);
}
