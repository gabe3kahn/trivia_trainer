import type { AttemptGrade, RecommendedQuestion } from '@/src/types/supabase';

export type GradeResult = {
  grade: AttemptGrade;
  label: string;
  detail: string;
};

export function gradeResponse(question: RecommendedQuestion, response: string): GradeResult {
  const submitted = normalizeAnswer(response);
  const acceptedAnswers = [question.answer, ...question.aliases].map(normalizeAnswer).filter(Boolean);
  // The reveal text shown after submitting. When `answer_detail` is set (e.g.
  // "Mona Lisa — Leonardo da Vinci" on a visual clue), show that regardless of
  // which part the clue asked for. Grading still uses `answer` + aliases only.
  const reveal = question.answer_detail || question.answer;
  const answerNumberKeys = new Set(acceptedAnswers.flatMap(extractNumberKeys));
  const submittedNumberKeys = new Set(extractNumberKeys(submitted));

  if (!submitted) {
    return {
      grade: 'unknown',
      label: 'No answer',
      detail: `Correct response: ${reveal}`,
    };
  }

  if (acceptedAnswers.some((answer) => submitted === answer || numericEquivalent(submitted, answer))) {
    return {
      grade: 'correct',
      label: 'Correct',
      detail: reveal,
    };
  }

  if (answerNumberKeys.size > 0 && !setsIntersect(answerNumberKeys, submittedNumberKeys)) {
    return {
      grade: 'missed',
      label: 'Missed',
      detail: `Correct response: ${reveal}`,
    };
  }

  // A near-string match means they effectively knew it — a typo, abbreviation,
  // or missing article (e.g. "JFK" for "John F. Kennedy"). That's fully correct,
  // not partial. (We don't attempt semantic "close" like Nixon-for-JFK.)
  if (acceptedAnswers.some((answer) => isClose(submitted, answer))) {
    return {
      grade: 'correct',
      label: 'Correct',
      detail: reveal,
    };
  }

  // Last-name-only answers. For a multi-word person ("Jackson Pollock"), accept
  // the surname alone ("Pollock") — and tolerate one misspelling on longer
  // surnames ("Pollack"→"Pollock"), where a single edit rarely lands on a
  // different real surname. Short surnames are excluded (too collision-prone).
  if ([question.answer, ...(question.aliases ?? [])].some((raw) => matchesSurname(submitted, raw))) {
    return {
      grade: 'correct',
      label: 'Correct',
      detail: reveal,
    };
  }

  return {
    grade: 'missed',
    label: 'Missed',
    detail: `Correct response: ${question.answer}`,
  };
}

function matchesSurname(submitted: string, rawAnswer: string) {
  // A hyphenated compound ("Counter-Reformation") isn't a First-Last person name — its
  // last word isn't a surname, so a bare last word ("Reformation") must not match it.
  if (/[a-z]-[a-z]/i.test(rawAnswer)) return false;
  const answer = normalizeAnswer(rawAnswer);
  const answerTokens = answer.split(' ').filter(Boolean);
  if (answerTokens.length < 2) return false;
  const surname = answerTokens[answerTokens.length - 1];
  if (surname.length < 5) return false;

  // Only a BARE surname qualifies for this shortcut ("Pollock" for "Jackson Pollock").
  // A multi-word submission that merely ENDS in the surname is NOT a surname-only answer
  // and must be judged as a full phrase — otherwise "winged horse of victory" is scored
  // correct against the alias "Winged Victory" just because both end in "victory".
  const submittedTokens = submitted.split(' ').filter(Boolean);
  if (submittedTokens.length !== 1) return false;
  const only = submittedTokens[0];
  if (only === surname) return true;
  // A different initial almost always means a different name, not a typo.
  if (only[0] !== surname[0]) return false;
  return surname.length >= 6 && levenshtein(only, surname) <= 1;
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
  // The contained run must be at least TWO tokens, so a shorter phrase that is its own
  // distinct entity isn't credited as a sub-phrase of a longer one ("Reformation" for
  // "Counter-Reformation", "York" for "New York City"). Genuine partials are multi-word
  // ("New York" ⊂ "New York City", "Huckleberry Finn" ⊂ "Adventures of Huckleberry Finn").
  if ((answerTokens.length >= 2 && containsTokenSequence(submittedTokens, answerTokens)) ||
      (submittedTokens.length >= 2 && containsTokenSequence(answerTokens, submittedTokens))) {
    return true;
  }

  const distance = levenshtein(submitted, answer);
  const maxLength = Math.max(submitted.length, answer.length);
  // Short answers are where fuzzy matching is most dangerous, because a tiny edit
  // often lands on a *different real word*. Two guards:
  //  - Equal-length edits are substitutions (Rhône→Rhine, Mars→Mark) → a different
  //    entity, not a typo. Reject.
  //  - A changed first letter usually means a different word too ("hone"≠"Rhône"),
  //    whereas dropped/added inner letters are real typos (Rone/Rhon→Rhône). Reject
  //    only when the initial differs.
  // Longer answers keep the normal fuzzy tolerance, where a stray edit is more
  // likely a genuine typo. The self-grade override is the safety net either way.
  if (maxLength < 8) {
    if (submitted.length === answer.length) return false;
    if (submitted[0] !== answer[0]) return false;
  }
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
