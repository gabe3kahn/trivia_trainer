import type { AttemptGrade, RecommendedQuestion } from '@/src/types/supabase';

export type GradeResult = {
  grade: AttemptGrade;
  label: string;
  detail: string;
};

export function gradeResponse(question: RecommendedQuestion, response: string): GradeResult {
  const submitted = normalizeAnswer(response);
  const acceptedAnswers = [question.answer, ...question.aliases].map(normalizeAnswer).filter(Boolean);
  const answerNumberKeys = new Set(acceptedAnswers.flatMap(extractNumberKeys));
  const submittedNumberKeys = new Set(extractNumberKeys(submitted));

  if (!submitted) {
    return {
      grade: 'unknown',
      label: 'No answer',
      detail: `Correct response: ${question.answer}`,
    };
  }

  if (acceptedAnswers.some((answer) => submitted === answer || numericEquivalent(submitted, answer))) {
    return {
      grade: 'correct',
      label: 'Correct',
      detail: question.answer,
    };
  }

  if (answerNumberKeys.size > 0 && !setsIntersect(answerNumberKeys, submittedNumberKeys)) {
    return {
      grade: 'missed',
      label: 'Missed',
      detail: `Correct response: ${question.answer}`,
    };
  }

  // A near-string match means they effectively knew it — a typo, abbreviation,
  // or missing article (e.g. "JFK" for "John F. Kennedy"). That's fully correct,
  // not partial. (We don't attempt semantic "close" like Nixon-for-JFK.)
  if (acceptedAnswers.some((answer) => isClose(submitted, answer))) {
    return {
      grade: 'correct',
      label: 'Correct',
      detail: question.answer,
    };
  }

  return {
    grade: 'missed',
    label: 'Missed',
    detail: `Correct response: ${question.answer}`,
  };
}

export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(what|who|where|when|why|how)\s+(is|are|was|were)\s+/i, '')
    .replace(/^(what|who|where|when|why|how)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isClose(submitted: string, answer: string) {
  if (submitted.length < 4 || answer.length < 4) return false;
  if (extractNumberKeys(answer).length > 0 && !setsIntersect(new Set(extractNumberKeys(submitted)), new Set(extractNumberKeys(answer)))) {
    return false;
  }
  // Token-level containment, not raw substring. Raw substring over-credited
  // "china" as close to "indochina" or "paris" to "comparison"; requiring a
  // whole-token match avoids matching inside a longer word.
  const submittedTokens = submitted.split(' ').filter(Boolean);
  const answerTokens = answer.split(' ').filter(Boolean);
  if (containsTokenSequence(submittedTokens, answerTokens) || containsTokenSequence(answerTokens, submittedTokens)) {
    return true;
  }

  const distance = levenshtein(submitted, answer);
  const maxLength = Math.max(submitted.length, answer.length);
  // A single substitution on a short answer usually turns one entity into a
  // *different* one (Rhône→Rhine, Mars→Mark), not a typo. Only forgive a short
  // answer when the edit adds or drops a character (insertion/deletion), which
  // is far more typo-like; block equal-length substitutions. Longer answers keep
  // the normal fuzzy tolerance, where a stray substitution is more likely a typo.
  if (maxLength < 8 && submitted.length === answer.length) return false;
  const tolerance = maxLength >= 10 ? 2 : 1;
  return distance <= tolerance;
}

function containsTokenSequence(haystack: string[], needle: string[]) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}

function numericEquivalent(submitted: string, answer: string) {
  const answerKeys = new Set(extractNumberKeys(answer));
  if (answerKeys.size === 0) return false;
  const submittedKeys = new Set(extractNumberKeys(submitted));
  if (!setsIntersect(answerKeys, submittedKeys)) return false;

  const answerWithoutNumbers = stripNumberTokens(answer);
  const submittedWithoutNumbers = stripNumberTokens(submitted);

  return !answerWithoutNumbers || answerWithoutNumbers === submittedWithoutNumbers;
}

function extractNumberKeys(value: string) {
  const compact = value.toLowerCase().replace(/-/g, ' ');
  const keys = [...compact.matchAll(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g)].map((match) => match[0].replace(/,/g, ''));
  const words: Record<string, string> = {
    zero: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
    eleven: '11',
    twelve: '12',
    thirteen: '13',
    fourteen: '14',
    fifteen: '15',
    sixteen: '16',
    seventeen: '17',
    eighteen: '18',
    nineteen: '19',
    twenty: '20',
    thirty: '30',
    forty: '40',
    fifty: '50',
    sixty: '60',
    seventy: '70',
    eighty: '80',
    ninety: '90',
    hundred: '100',
    thousand: '1000',
  };

  for (const token of compact.split(/\s+/)) {
    if (words[token]) keys.push(words[token]);
  }

  return [...new Set(keys)];
}

function setsIntersect(a: Set<string>, b: Set<string>) {
  for (const item of a) {
    if (b.has(item)) return true;
  }
  return false;
}

function stripNumberTokens(value: string) {
  const numberWords = new Set([
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
    'hundred',
    'thousand',
  ]);

  return value
    .split(/\s+/)
    .filter((token) => token && !/^\d+(?:\.\d+)?$/.test(token) && !numberWords.has(token))
    .join(' ');
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}
