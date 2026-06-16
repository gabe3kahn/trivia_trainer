import { applyManualClueOverrides } from './manual-clue-overrides.mjs';
import { decideFromScore } from './quality-constants.mjs';

export function auditQuestion(row) {
  const clue = String(row.clue ?? '').trim();
  const answer = String(row.answer ?? '').trim();
  const issues = [];
  const warnings = [];
  let score = 100;

  // Leading wh-word only counts as a real interrogative when the clue is NOT
  // declarative. Real board clues like "Where the rivers meet, THIS city…" begin
  // with "Where" but point at the answer with "this/these", so they're fine.
  const startsInterrogative = /^(what|who|which|when|where|why|how)\b/i.test(clue);
  const hasDeclarativePointer = /\b(this|these|those)\b/i.test(clue);
  addIf(startsInterrogative && (!hasDeclarativePointer || /\?$/.test(clue)), 'direct-interrogative', 35);
  addIf(/\?$/.test(clue), 'question-mark-form', 20);
  addIf(/(\.{3}|…)\s*$/i.test(clue), 'ellipsis-ending-or-fill-in', 25);
  addIf(/\b(which of the following|which one of these|which of these|of the following|multiple choice)\b/i.test(clue), 'visible-multiple-choice-dependency', 45);
  addIf((row.tags ?? []).includes('multiple'), 'provider-multiple-choice-source', 10);
  addIf((row.tags ?? []).includes('boolean') || /^(true|false)$/i.test(answer), 'true-false-source', 60);

  addIf(/\bthis number answers how many\b/i.test(clue), 'awkward-how-many-conversion', 40);
  addIf(/\bthis number of\b/i.test(clue), 'ungrammatical-number-conversion', 35);
  addIf(/\bthis is the (name|relationship|term|word) of\b/i.test(clue), 'awkward-name-of-conversion', 25);
  addIf(/\bunder what\b/i.test(clue) || /\bwhere does\b/i.test(clue) || /\bhow many\b/i.test(clue), 'residual-question-syntax', 30);
  addIf(/\bthis (person|figure|place|country|city|number) (is|was|answers)\b/i.test(clue), 'generic-answer-class-wrapper', 8);

  addIf(/\bverb mood\b/i.test(clue), 'grammar-jargon-answer-class', 40);
  addIf(/\b(subjunctive|gerund|participle|pluperfect|ablative|dative)\b/i.test(answer), 'jargon-answer', 18);
  addIf(/\b(correct|incorrect|not|except|least|false)\b/i.test(clue) && row.source === 'opentdb', 'negative-provider-clue', 18);

  // Time-sensitive wording. The bare word "current" was removed: it false-flagged
  // "ocean current", "electric current", "current events", etc. The explicit
  // temporal phrases below ("currently", "as of", "most recent") are the real signal.
  addIf(/\b(as of|currently|latest|newest|most recent)\b/i.test(clue), 'time-sensitive-wording', 25);
  addIf(/\b(released in 20[0-9]{2}|in 201[0-9]|in 202[0-9])\b/i.test(clue) && row.category_id === 'pop_culture_media_modern_life', 'possibly-time-sensitive-pop-culture', 8);

  const wordCount = clue.split(/\s+/).filter(Boolean).length;
  // Visual clues (the image is the prompt, e.g. "Name this painting.") are short
  // by design — don't penalize them for being thin.
  addIf(String(row.mechanic) !== 'visual' && wordCount < 8, 'thin-clue', 15);
  addIf(wordCount > 34, 'overlong-clue', 10);
  // Soft signals: surfaced as warnings, NOT scored. They are coarse regex
  // heuristics with a high false-positive rate (they flag plenty of fine
  // clues), so they should inform an editor rather than gate import.
  warn(!hasSpecificAnchor(clue), 'low-anchor-density');
  warn(!hasAnswerClassSignal(row), 'unclear-answer-class');

  addIf((row.aliases ?? []).length === 0 && answer.split(/\s+/).length > 1, 'missing-multiword-aliases', 8);
  addIf(answer.length <= 2 && !/^\d+$/.test(answer), 'very-short-answer-needs-strong-clue', 8);

  addIf(row.source === 'opentdb', 'provider-row-needs-editorial-review', 5);

  // Note: answer-content/answer-phrase leakage is detected in feedback-quality-rules.mjs
  // (a single source) rather than duplicated here with a separate token list.

  const safeScore = Math.max(0, score);
  return { score: safeScore, decision: decideFromScore(safeScore), issues, warnings };

  function addIf(condition, issue, penalty) {
    if (!condition) return;
    score -= penalty;
    issues.push(issue);
  }

  function warn(condition, issue) {
    if (condition) warnings.push(issue);
  }
}

export function isActiveQualityDecision(decision) {
  return decision === 'keep' || decision === 'rewrite';
}

export function prepareQuestionForIntake(row) {
  const next = { ...row, clue: String(row.clue ?? '').replace(/\s+/g, ' ').trim() };

  // Editorial one-offs first; if one applies it owns the clue and we don't reframe.
  const overrideId = applyManualClueOverrides(next, row);
  if (!overrideId) {
    const wordCount = next.clue.split(/\s+/).filter(Boolean).length;
    if (wordCount < 8 && String(next.mechanic) !== 'visual') {
      // Frame thin clues with a category lead-in (skip visual clues — the image is
      // the prompt, so "Name this painting." should stay as written). We intentionally PRESERVE the
      // clue's original casing instead of lowercasing the first letter, so that
      // acronyms and proper nouns (DNA, USA, Einstein) are never corrupted.
      next.clue = `${categoryFrame(row.category_id)}, ${next.clue}`;
    }
  }

  return next;
}

function categoryFrame(categoryId) {
  return {
    arts_visual_culture: 'In art history',
    geography: 'In geography',
    history: 'In history',
    language_wordplay: 'In wordplay',
    literature_books: 'In literature',
    music_performing_arts: 'In music and theater',
    pop_culture_media_modern_life: 'In modern culture',
    religion_mythology_philosophy: 'In religion and philosophy',
    science: 'In science',
    sports_games_leisure: 'In sports and games',
  }[categoryId] ?? 'In trivia';
}

function hasSpecificAnchor(clue) {
  return /\b(1[0-9]{3}|20[0-9]{2}|[A-Z][a-z]{2,}|[A-Z]{2,}|"|'|named|called|known|wrote|created|founded|won|born|died|capital|river|novel|album|film|series|war|president|king|queen|god|goddess)\b/.test(clue);
}

function hasAnswerClassSignal(row) {
  const clue = String(row.clue ?? '').toLowerCase();
  const answer = String(row.answer ?? '').trim();
  if (/^\d+$/.test(answer)) return /\b(this many|this number|number of|year|age|percent|percentage|score|rank)\b/i.test(clue);
  return /\b(this|these|that|its|he|she|his|her|their|title|word|term|name|city|country|state|river|author|artist|composer|novel|book|film|album|person|figure|place|language|god|goddess|king|queen|president|company|brand|team)\b/i.test(String(row.clue ?? ''));
}
