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
 * Deterministic + stable: the importer stamps these onto every clue (migration 036,
 * questions.topic_entities), a backfill fills the existing bank, and the critic reads them
 * for its advisory `related` check. The tags are stored so they're consistent across runs
 * and a bad extraction can be corrected in place.
 */

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
