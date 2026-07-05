/**
 * Readability / wording score — a DETERMINISTIC measure of how convoluted a clue reads, so a
 * tortured clue (nested qualifiers, buried subject, stacked em-dash asides) gets flagged even
 * though it has no leak and passes the difficulty gate. The critic's LLM "wording" dimension
 * under-fired on exactly these (Polonium, Entropy, Absolute zero in the #116 review), so this
 * gives a cheap, consistent second opinion.
 *
 * Scores 0–100 (100 = clean). Each signal below subtracts points; the caller decides the floor
 * (see calibrate-readability.mjs — the threshold is tuned against the J! Archive paragon corpus
 * so well-written real clues don't trip it). Weights live in WEIGHTS so calibration can tune them
 * in one place.
 *
 * NOTE: this measures CONVOLUTION, not correctness. Punctuation *errors* (comma splices, a stray
 * comma) are a different thing and want a hard rule, not a soft score — see calibrate's report.
 */

export const WEIGHTS = {
  sentenceLongish: 8, // > 32 words
  sentenceLong: 16, // > 38
  sentenceVeryLong: 28, // > 45
  subjectBuried: 10, // this/it after >= 10 words
  subjectBuriedDeep: 20, // after >= 16 words
  definitionSandwich: 18, // heavy content BEFORE the subject AND more facts AFTER it (crammed)
  emDashAside: 8, // 2 em-dashes (one aside)
  emDashPileup: 16, // >= 3
  clauses: 8, // 3 subordinate/relative markers
  stackedClauses: 15, // >= 4
  qualifierPhrase: 10, // "on the basis of", "in the manner of", …
  prepositionPileup: 12, // >= 10 prepositions
  commas: 6, // 4 commas in one sentence
  commaHeavy: 12, // >= 5
};

const SUBJECT_MARKER = /\b(this|these|those|it)\b/i;
const CLAUSE_MARKERS = /\b(which|who|whom|whose|that|where|whereby|wherein)\b/gi;
const QUALIFIER_PHRASES = /\b(on the basis of|in the manner of|by way of|by virtue of|on account of|with no\b[^,.]*\balone)\b/i;
const PREPOSITIONS = /\b(of|in|on|by|with|from|for|to|at|through|upon|into|onto|within|between|among)\b/gi;

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

/**
 * @returns {{score:number, penalties:{reason:string,points:number}[], metrics:object}}
 */
export function scoreReadability(clue) {
  const text = String(clue ?? '').trim();
  if (!text) return { score: 100, penalties: [], metrics: {} };
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const penalties = [];
  const push = (reason, points) => penalties.push({ reason, points });

  // 1. longest sentence length
  const longest = Math.max(...sentences.map(wordCount));
  if (longest > 45) push('sentence-very-long', WEIGHTS.sentenceVeryLong);
  else if (longest > 38) push('sentence-long', WEIGHTS.sentenceLong);
  else if (longest > 32) push('sentence-longish', WEIGHTS.sentenceLongish);

  // 2. front-loaded subject — the "this/it" marker buried behind an opening clause
  const marker = text.match(SUBJECT_MARKER);
  let subjectDepth = 0;
  let afterSubject = 0;
  if (marker && marker.index > 0) {
    subjectDepth = text.slice(0, marker.index).split(/\s+/).filter(Boolean).length;
    afterSubject = text.slice(marker.index).split(/\s+/).filter(Boolean).length;
    if (subjectDepth >= 16) push('subject-buried-deep', WEIGHTS.subjectBuriedDeep);
    else if (subjectDepth >= 10) push('subject-buried', WEIGHTS.subjectBuried);
  }
  // "Definition sandwich" candidate: a heavy clause BEFORE the subject AND still more predicate
  // AFTER it. Note: this ALONE is normal expository style ("Founded in 1764…, this museum holds…"
  // — Hermitage, Sinatra, Boston Marathon all read fine), so it is NOT penalized on its own.
  const sandwich = Boolean(marker && marker.index > 0 && subjectDepth >= 8 && afterSubject >= 9);

  // 3. em-dash asides
  const emDashes = (text.match(/—/g) || []).length;
  if (emDashes >= 3) push('em-dash-pileup', WEIGHTS.emDashPileup);
  else if (emDashes === 2) push('em-dash-aside', WEIGHTS.emDashAside);

  // 4. stacked subordinate/relative clauses
  const clauseCount = (text.match(CLAUSE_MARKERS) || []).length;
  if (clauseCount >= 4) push('stacked-clauses', WEIGHTS.stackedClauses);
  else if (clauseCount === 3) push('clauses', WEIGHTS.clauses);

  // Cram = the sandwich PLUS a THIRD stacked element (an em-dash aside or ≥3 subordinate clauses).
  // That third piece is what separates a genuine cram (Entropy: setup, "this quantity", —aside—,
  // then a final fact) from a clean setup+subject+predicate clue.
  if (sandwich && (emDashes >= 2 || clauseCount >= 3)) push('crammed-sandwich', WEIGHTS.definitionSandwich);

  // 5. qualifier-phrase pileups / preposition density
  if (QUALIFIER_PHRASES.test(text)) push('qualifier-phrase', WEIGHTS.qualifierPhrase);
  const prepCount = (text.match(PREPOSITIONS) || []).length;
  if (prepCount >= 10) push('preposition-pileup', WEIGHTS.prepositionPileup);

  // 6. comma density (worst single sentence)
  const maxCommas = Math.max(...sentences.map((s) => (s.match(/,/g) || []).length));
  if (maxCommas >= 5) push('comma-heavy', WEIGHTS.commaHeavy);
  else if (maxCommas === 4) push('commas', WEIGHTS.commas);

  const score = Math.max(0, 100 - penalties.reduce((a, p) => a + p.points, 0));
  return { score, penalties, metrics: { longest, subjectDepth, emDashes, clauseCount, prepCount, maxCommas } };
}
