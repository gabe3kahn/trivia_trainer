export function evaluateDifficulty(row) {
  const clue = String(row.clue ?? '').trim();
  const answer = String(row.answer ?? '').trim();
  const tags = new Set(row.tags ?? []);
  const clueTokens = tokenize(clue);
  const answerTokens = tokenize(answer);
  const currentRank = valueToRank(row.value);
  const reasons = [];
  // Blend the assigned value (prior) with a neutral mid-rank so unsupported
  // clues shrink toward the middle of the scale.
  let score = (currentRank * 0.72) + (2.4 * 0.28);
  // Each adjustment is recorded as a signal {amount, weight}. Confidence is
  // derived AFTER the loop from how much these signals agree, not from how many
  // fired — conflicting easier/harder signals should lower confidence, not raise it.
  const signals = [];

  if (tags.has('easy')) adjust(-0.55, 0.14, 'provider-easy');
  if (tags.has('medium')) adjust(0, 0.08, 'provider-medium');
  if (tags.has('hard')) adjust(0.9, 0.14, 'provider-hard');

  if (row.source === 'manual_seed') adjust(-0.2, 0.05, 'introductory-seed');
  if (row.source === 'gap_pack' || row.source === 'original_gap_pack') adjust(0.1, 0.05, 'editorial-gap-pack');

  const normalizedAnswer = normalizeAnswer(answer);
  if (COMMON_ANSWERS.has(normalizedAnswer)) adjust(-0.65, 0.18, 'high-recognition-answer');
  if (!COMMON_ANSWERS.has(normalizedAnswer) && answerTokens.length >= 2 && hasProperNounShape(answer)) {
    adjust(0.25, 0.08, 'specific-answer-form');
  }
  if (answerTokens.length >= 3) adjust(0.4, 0.08, 'long-answer-form');
  if (answerTokens.length === 1 && answerTokens[0].length <= 4) adjust(-0.15, 0.04, 'short-answer-form');
  if (/^\d{4}$/.test(answer)) adjust(0.45, 0.12, 'exact-year-answer');
  if (/^\d+$/.test(answer) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|hundred|thousand|million|billion)\b/i.test(answer)) {
    adjust(0.2, 0.07, 'numeric-answer');
  }

  const strongAnchors = countStrongAnchors(clue);
  if (strongAnchors >= 3) adjust(-0.12, 0.08, 'many-strong-clue-anchors');
  if (strongAnchors <= 1) adjust(0.24, 0.07, 'few-strong-clue-anchors');

  const words = clueTokens.length;
  if (words < 10) adjust(0.1, 0.04, 'short-clue');
  if (words > 24) adjust(-0.15, 0.04, 'generous-clue-length');

  if (/\b(named for|capital of|author of|wrote|created|painted|composed|founded|hosted|invented|discovered)\b/i.test(clue)) {
    adjust(-0.08, 0.06, 'direct-canonical-hook');
  }
  if (/\b(symbol|abbreviation|stands for|opposite of|capital of|largest|smallest|first book|logo|nicknamed|features|begins with|made from|used for|means)\b/i.test(clue)) {
    adjust(-0.12, 0.06, 'direct-recognition-hook');
  }
  if (/\b(second|third|minor|lesser|notable for|associated with|originally|first appeared|debuted|released the album|won the.*award)\b/i.test(clue)) {
    adjust(0.3, 0.09, 'specific-detail-hook');
  }
  if (/\b(except|not|least|incorrect|false)\b/i.test(clue)) {
    adjust(0.25, 0.08, 'negative-logic');
  }
  if (row.mechanic && row.mechanic !== 'standard') {
    adjust(0.15, 0.08, 'wordplay-mechanic');
  }

  const subcategoryName = row.subcategories?.name ?? row.subcategory_name;
  const categoryName = row.category_name ?? row.category ?? subcategoryName;
  if (isWordplayOrGimmickCategory(categoryName) || isWordplayOrGimmickCategory(subcategoryName)) {
    adjust(0.32, 0.09, 'category-gimmick');
  }
  if (isSpecializedCategoryText(categoryName) || isSpecializedCategoryText(subcategoryName)) {
    adjust(0.18, 0.06, 'specialized-category-title');
  }
  if (SPECIALIST_CATEGORIES.has(subcategoryName)) adjust(0.25, 0.08, 'specialist-subcategory');
  if (BROAD_ACCESSIBLE_SUBCATEGORIES.has(subcategoryName)) adjust(-0.25, 0.08, 'broad-accessible-subcategory');

  score = Math.max(1, Math.min(5, score));

  // Confidence = base + (evidence scaled by directional agreement).
  // evidence is the total weight of signals that fired; agreement is how aligned
  // the score-moving signals are (1 = all push the same way, ~0 = they cancel).
  const evidence = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const directional = signals.filter((signal) => signal.amount !== 0);
  const totalAbs = directional.reduce((sum, signal) => sum + Math.abs(signal.amount), 0);
  const net = directional.reduce((sum, signal) => sum + signal.amount, 0);
  const agreement = totalAbs > 0 ? Math.abs(net) / totalAbs : 1;
  const confidence = Math.max(0.3, Math.min(0.9, 0.52 + evidence * agreement));

  const suggestedRank = Math.max(1, Math.min(5, Math.round(score)));
  const suggestedValue = rankToValue(suggestedRank);
  const deltaRank = suggestedRank - currentRank;

  return {
    score: Number(score.toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    current_rank: currentRank,
    current_value: row.value,
    suggested_rank: suggestedRank,
    suggested_value: suggestedValue,
    delta_rank: deltaRank,
    verdict: deltaRank <= -2 ? 'likely-overrated' : deltaRank === -1 ? 'possibly-overrated' : deltaRank === 0 ? 'calibrated' : deltaRank === 1 ? 'possibly-underrated' : 'likely-underrated',
    reasons,
  };

  function adjust(amount, weight, reason) {
    score += amount;
    signals.push({ amount, weight });
    reasons.push(reason);
  }
}

export function chooseCalibratedValue(row, difficulty) {
  const current = Number(row.value);
  const suggested = Number(difficulty.suggested_value);
  const confidence = Number(difficulty.confidence);
  const reasons = new Set(difficulty.reasons ?? []);

  if (difficulty.verdict === 'likely-overrated') {
    if (current >= 1000) return Math.max(600, suggested);
    if (current >= 800) return Math.max(400, suggested);
    if (current >= 600 && confidence >= 0.7) return Math.max(400, suggested);
  }

  if (difficulty.verdict === 'possibly-overrated' && current >= 800 && confidence >= 0.7) {
    return rankToValue(valueToRank(current) - 1);
  }

  const hardSignal =
    reasons.has('exact-year-answer') ||
    reasons.has('numeric-answer') ||
    reasons.has('specialist-subcategory') ||
    reasons.has('specialized-category-title') ||
    reasons.has('category-gimmick') ||
    reasons.has('specific-answer-form') ||
    (reasons.has('wordplay-mechanic') && reasons.has('long-answer-form')) ||
    (reasons.has('provider-easy') && reasons.has('long-answer-form') && confidence >= 0.82);

  if (difficulty.verdict === 'likely-underrated' && hardSignal) {
    return Math.min(600, suggested);
  }

  if (difficulty.verdict === 'possibly-underrated' && hardSignal && confidence >= 0.75) {
    return rankToValue(valueToRank(current) + 1);
  }

  return current;
}

export function valueToRank(value) {
  return ({ 200: 1, 400: 2, 600: 3, 800: 4, 1000: 5 })[Number(value)] ?? 2;
}

export function rankToValue(rank) {
  return ({ 1: 200, 2: 400, 3: 600, 4: 800, 5: 1000 })[Number(rank)] ?? 400;
}

function countStrongAnchors(clue) {
  let count = 0;
  if (/\b(1[0-9]{3}|20[0-9]{2})\b/.test(clue)) count += 1;
  if (/"[^"]+"|'[^']+'/.test(clue)) count += 1;
  if (/\b[A-Z][a-z]{2,}\b/.test(clue)) count += 1;
  if (/\b(named|called|known|wrote|created|painted|composed|founded|won|born|died|capital|river|novel|album|film|series|war|president|king|queen|god|goddess)\b/i.test(clue)) count += 1;
  if (/\b(author|artist|composer|city|country|state|company|team|language|element|planet|moon|treaty|battle)\b/i.test(clue)) count += 1;
  return count;
}

function tokenize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeAnswer(value) {
  return tokenize(value).join(' ');
}

function hasProperNounShape(value) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  return words.some((word) => /^[A-Z][a-zA-Z.'-]{2,}$/.test(word));
}

function isWordplayOrGimmickCategory(value) {
  return /\b(before|after|starts? with|ends? in|ending in|rhyme|anagram|palindrome|quote|quotes|idiom|idioms|sound|sounds|homophone|letter|letters|initial|initials|abbrev|crossword|word|words|pun|puns|fill|blank|two words|2 words|give us|no time to say|soy que|soy what)\b/i.test(String(value ?? ''));
}

function isSpecializedCategoryText(value) {
  return /\b(nobel|civil war|19th century|18th century|mythology|geometry|aviation|lakes|weights|measures|alma maters|state capitals|fresco|playwright|playwrights|poetry|opera|treaty|treaties|battle|battles|flags|fiddlin|science facts|stock|company leader)\b/i.test(String(value ?? ''));
}

const COMMON_ANSWERS = new Set([
  'abraham lincoln',
  'africa',
  'albert einstein',
  'amazon',
  'apollo',
  'atlantic ocean',
  'barack obama',
  'beethoven',
  'berlin',
  'bible',
  'boston',
  'california',
  'canada',
  'charles dickens',
  'china',
  'cleopatra',
  'earth',
  'egypt',
  'elvis presley',
  'england',
  'france',
  'george washington',
  'germany',
  'hamlet',
  'india',
  'jane austen',
  'japan',
  'jupiter',
  'leonardo da vinci',
  'london',
  'mars',
  'michael jackson',
  'mozart',
  'new york',
  'paris',
  'rome',
  'russia',
  'shakespeare',
  'statue of liberty',
  'titanic',
  'united states',
  'venus',
  'world war ii',
]);

const SPECIALIST_CATEGORIES = new Set([
  'Art Terms & Techniques',
  'Awards, Movements & Terms',
  'Dates, Documents & Treaties',
  'Demonyms & Languages',
  'Ethics & Political Thought',
  'Foreign Words & Phrases',
  'Grammar & Usage',
  'Music Theory & Terms',
  'Patrons, Critics & Schools',
  'Philosophical Schools',
  'Religious Texts & Terms',
  'Rules & Terminology',
  'Units, Laws & Constants',
]);

const BROAD_ACCESSIBLE_SUBCATEGORIES = new Set([
  'Baseball',
  'Basketball',
  'Film',
  'Food & Drink',
  'Football',
  'Greek Mythology',
  'Popular Music',
  'Television',
  'U.S. Presidents & Elections',
  'World Capitals',
]);
