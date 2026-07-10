/**
 * Topic entities — the concrete handle for RELATED-clue detection (same fact, different
 * answer), which the answer-based dedup gate can't see.
 *
 * "Same fact" is too vague to encode; shared distinctive ENTITIES are concrete and
 * explainable. A clue's entities = the years and proper-noun tokens in its answer + clue
 * text, minus a stoplist of common/ambiguous capitalized words. Two clues are "related"
 * when they share several — e.g. a Siege-of-Yorktown clue and a Charles-Cornwallis clue
 * share {1781, virginia, revolutionary}; a George-Eliot clue and a Middlemarch clue share
 * {george, eliot, mary, evans, victorian}.
 *
 * Tags are LLM-generated (Haiku, via the shared llm-batch component) so they capture the
 * subject's canonical ASSOCIATIONS — Mona Lisa → leonardo da vinci, louvre, renaissance,
 * florence — not merely words the clue happens to contain. `extractTopicEntities` (regex over
 * answer+clue) is the OFFLINE FALLBACK when no LLM is available. Stored per clue (migration
 * 036, questions.topic_entities): the drafter tags each draft (tag-pack), a backfill fills the
 * existing bank, the importer persists them, and the critic reads them for its advisory
 * `related` check — so tags are consistent across runs and a bad one can be corrected in place.
 */
import { batchClassify } from './llm-batch.mjs';

// Common / ambiguous capitalized words that create false overlaps (nationalities, calendar
// words, generic determiners, weak geo/qualifier words). Distinctive names (Cornwallis,
// Yorktown, Gwendolen, Trent, Middlemarch) are intentionally NOT here.
const STOP = new Set((
  'this these those that the a an and or but of in on at to for from with by as it its his her their they them ' +
  'when where who what which while after before during between over under above below into onto about within across ' +
  'american british english french spanish italian german japanese chinese russian greek roman latin european african asian ' +
  'north south east west northern southern eastern western ' +
  'january february march april may june july august september october november december ' +
  'monday tuesday wednesday thursday friday saturday sunday ' +
  'first second third fourth last new old great known most many some other each both several ' +
  'national international united states kingdom century early late modern ancient'
).split(/\s+/));

/**
 * Extract the normalized, de-duplicated entity list for a clue.
 * @param {string} answer
 * @param {string} clue
 * @returns {string[]} sorted unique entities (years + lowercased proper-noun tokens)
 */
export function extractTopicEntities(answer, clue) {
  const out = new Set();
  const text = `${answer ?? ''} ${clue ?? ''}`;
  for (const m of text.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)) out.add(m[1]);
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z]{3,})\b/g)) {
    const w = m[1].toLowerCase();
    if (!STOP.has(w)) out.add(w);
  }
  return [...out].sort();
}

/** Entities shared by two entity lists. */
export function sharedEntities(a, b) {
  const setB = new Set(b);
  return (a || []).filter((x) => setB.has(x));
}

/**
 * How many shared entities count as "related", given two clues' categories. A real
 * cross-category collision usually shares MORE (a same-answer/same-topic pair), so we
 * demand a higher bar across categories to cut the ambiguous-token noise the prototype
 * surfaced (e.g. "Washington" the person vs. the place).
 */
export function relatedThreshold(catA, catB) {
  return catA === catB ? 2 : 3;
}

const MAX_ENTITIES = 8;

/**
 * Normalize an LLM entity list: lowercase, collapse spaces, drop empty/short/generic, dedupe, cap,
 * sort. Multi-word entities are kept ATOMIC (internal spaces collapsed, never split) — the
 * related-check counts whole strings, so "westminster abbey" is one shared entity, not two.
 */
export function normalizeEntities(arr) {
  const out = [];
  for (const raw of Array.isArray(arr) ? arr : []) {
    const e = String(raw ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (e.length < 3 || STOP.has(e)) continue;
    if (!out.includes(e)) out.push(e);
  }
  return out.slice(0, MAX_ENTITIES).sort();
}

function buildEntityPrompt(batch) {
  const list = batch.map((c) => `- ${c.id} | ${c.answer} — "${String(c.clue || '').replace(/"/g, "'").slice(0, 220)}"`).join('\n');
  return [
    'For each trivia clue below (id | answer — example clue), list the 5–8 most DISTINCTIVE real-world',
    'entities most closely ASSOCIATED with its ANSWER — the specific people, places, works, organizations,',
    'movements, and years a knowledgeable person connects to it — so that two clues covering the same subject',
    'can be detected. INCLUDE key associations even when the clue text does not mention them (e.g. "Mona Lisa"',
    '→ leonardo da vinci, louvre, renaissance, florence, 1503).',
    'Stay FIRST-ORDER: tag only what the answer directly IS, made, belongs to, or is set in — NOT second-order',
    'tangents like the scientist or theory that later EXPLAINED it, a remote cause, or general-domain background.',
    'E.g. "Tides" → moon, ocean, tide table, coast — NOT isaac newton / principia mathematica / gravity (those',
    'explain the phenomenon; they are not what the clue is about).',
    'Prefer proper nouns and years; keep the answer',
    "itself when it's a proper noun. Avoid generic words. Keep each multi-word entity as ONE tag",
    "(e.g. 'westminster abbey', 'new york city', 'natural selection') — NEVER split it into separate",
    'words, since two clues that merely share the generic halves would then look falsely related.',
    "Output ONLY a JSON object mapping each clue's id (verbatim) to its lowercase entity array — no prose, no code fences.",
    '',
    'Clues:',
    list,
  ].join('\n');
}

/**
 * LLM-tag clues with topic entities. `clues`: [{ id, answer, clue }]. Returns Map(id -> string[]).
 * Batched + resumable via the shared llm-batch component; `onBatch({ index, batches, tagged })`
 * fires after each batch with that batch's tagged clues (`{ ...clue, topic_entities }`) so the
 * caller can persist progress. Uses Haiku by default — bulk classification, not reasoning.
 */
export async function llmTagEntities(clues, { batchSize = 40, model = 'claude-haiku-4-5', onBatch } = {}) {
  const out = new Map();
  await batchClassify({
    items: clues,
    buildPrompt: buildEntityPrompt,
    batchSize,
    model,
    onBatch: async ({ index, batches, batch, parsed }) => {
      const tagged = [];
      for (const c of batch) {
        const v = parsed[String(c.id)] ?? parsed[c.answer];
        const ent = Array.isArray(v) ? normalizeEntities(v) : [];
        out.set(String(c.id), ent);
        if (ent.length) tagged.push({ ...c, topic_entities: ent });
      }
      if (onBatch) await onBatch({ index, batches, tagged });
    },
  });
  return out;
}
