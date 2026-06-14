export function auditFeedbackIssues(row) {
  const clue = String(row.clue ?? '').trim();
  const answer = String(row.answer ?? '').trim();
  const issues = [];
  const notes = [];
  let severity = 0;

  add(/\.\.\.\s*$/.test(clue), 'trailing-ellipsis', 8, 'Clue ends with ellipses instead of stating the expected unit or completion.');
  add(/\b(fill in|complete this)\b/i.test(clue), 'fill-in-prompt-shape', 5, 'Clue may be asking for completion rather than a Jeopardy-style response.');
  add(/\b(kick the can down the what|the what)\b/i.test(clue), 'placeholder-wording', 9, 'Clue exposes a converted quiz-question placeholder.');
  add(/\b(this number answers how many|this number of|number answers)\b/i.test(clue), 'awkward-number-wrapper', 8, 'Clue uses an awkward wrapper around a numerical answer.');

  const answerNumber = numericConcept(answer);
  const unit = answerUnit(answer);
  const asksForNumber = /\b(this many|this number|number of|how many|amount of|percentage|percent|ratio|score|age|year|date)\b/i.test(clue);
  const asksForNamedWork = /\b(novel|book|poem|play|film|movie|album|song|series|manga|game|entry|model|make and model|title)\b/i.test(clue);
  const clueMentionsUnit = unit && new RegExp(`\\b${escapeRegex(unit)}s?\\b`, 'i').test(clue);
  const clueHasUnitHint = /\b(years?|months?|days?|hours?|minutes?|seconds?|miles?|kilometers?|met(?:er|re)s?|feet|inches|pounds?|ounces?|grams?|tons?|percent|degrees?|points?|runs?|games?|books?|volumes?|frequency|price|cost|height|value)\b/i.test(clue);

  if (answerNumber && !isIdiomClue(row) && !asksForNamedWork && !asksForNumber && !clueHasUnitHint) {
    add(true, 'numeric-answer-with-weak-unit-signal', 6, 'Answer is numeric, but the clue gives little guidance about the expected unit or kind of number.');
  }

  if (answerNumber && !isIdiomClue(row) && !asksForNamedWork && unit && !clueMentionsUnit && !clueHasUnitHint) {
    add(true, 'numeric-unit-answer-without-unit-signal', 7, `Answer includes a ${unit} unit, but the clue does not clearly ask for that unit.`);
  }

  if (!answerNumber && unitOnly(answer) && !isIdiomClue(row)) {
    add(true, 'unit-only-answer', 9, 'Answer appears to be only a unit, which can produce Moore-law-style false positives.');
  }

  if (/\b(would|will|does|can)\s+\w+\s+every\b/i.test(clue) && !clueHasUnitHint) {
    add(true, 'every-without-unit', 7, 'Clue uses "every" but does not state the time/distance/unit dimension.');
  }

  const leaks = answerTokenLeak(row);
  if (leaks.length > 0) {
    add(true, 'answer-content-word-in-clue', Math.min(10, 3 + leaks.length * 2), `Potential leaked answer words: ${leaks.join(', ')}.`);
  }

  const exactLeak = exactAnswerLeak(row);
  if (exactLeak) {
    add(true, 'answer-phrase-in-clue', 10, 'The answer or an alias appears directly in the clue.');
  }

  // Stem leak: a clue word that shares a root with the answer telegraphs it even
  // though it isn't an exact token match (e.g. "southernmost" → "Southern Ocean",
  // "Mexican" → "Mexico"). Severity is set to flag the clue for a rewrite.
  const stemLeaks = answerStemLeak(row);
  if (stemLeaks.length > 0) {
    add(true, 'answer-stem-in-clue', 12, `Clue word(s) share a stem with the answer: ${stemLeaks.join(', ')}.`);
  }

  const categoryName = String(row.categories?.name ?? row.category_name ?? row.category_id ?? '').toLowerCase();
  if (categoryName.includes('wordplay') && row.mechanic === 'standard' && /\b(the word|this word|these letters)\b/i.test(clue)) {
    add(true, 'wordplay-answer-form-needs-extra-care', 3, 'Wordplay-shaped clue should be checked for exact answer-form ambiguity.');
  }

  return { severity, issues, notes };

  function add(condition, issue, weight, note) {
    if (!condition) return;
    issues.push(issue);
    notes.push(note);
    severity += weight;
  }
}

function answerTokenLeak(row) {
  if (['anagram', 'before_after', 'rhyme_time', 'word_ladder', 'crossword_clue', 'starts_with', 'ends_with', 'contains'].includes(row.mechanic)) {
    return [];
  }

  const clueTokens = new Set(tokenize(row.clue));
  return tokenize(row.answer)
    .filter((token) => token.length >= 5 || IMPORTANT_SHORT_WORDS.has(token))
    .filter((token) => !STOP_WORDS.has(token) && !ALLOWED_CLASS_WORDS.has(token) && !UNITS.has(token.replace(/s$/, '')))
    .filter((token) => clueTokens.has(token));
}

// Flags clue words that share a 5-character stem with a distinctive answer word
// (but aren't an exact token match — those are caught above). Skips generic
// geographic/political nouns so e.g. "oceanic" doesn't flag "Ocean".
function answerStemLeak(row) {
  if (['anagram', 'before_after', 'rhyme_time', 'word_ladder', 'crossword_clue', 'starts_with', 'ends_with', 'contains'].includes(row.mechanic)) {
    return [];
  }

  const answerTokens = tokenize(row.answer);
  const answerStems = answerTokens
    .filter((token) => token.length >= 5)
    .filter((token) => !STOP_WORDS.has(token) && !ALLOWED_CLASS_WORDS.has(token) && !UNITS.has(token.replace(/s$/, '')) && !GEO_GENERIC.has(token))
    .map((token) => token.slice(0, 5));

  if (!answerStems.length) return [];

  const hits = [];
  for (const ct of tokenize(row.clue)) {
    if (ct.length < 5 || answerTokens.includes(ct)) continue; // exact matches handled by answerTokenLeak
    if (answerStems.includes(ct.slice(0, 5))) hits.push(ct);
  }
  return [...new Set(hits)];
}

function exactAnswerLeak(row) {
  if (['anagram', 'before_after', 'rhyme_time', 'word_ladder', 'crossword_clue', 'starts_with', 'ends_with', 'contains'].includes(row.mechanic)) {
    return false;
  }

  const clueTokens = normalizeTokens(row.clue);
  const candidates = [row.answer, ...(row.aliases ?? [])]
    .map(normalizeTokens)
    .filter((value) => value.length === 1 ? value[0].length >= 3 : value.length > 1);

  return candidates.some((candidate) => containsTokenSequence(clueTokens, candidate));
}

function numericConcept(value) {
  const tokens = String(value ?? '')
    .toLowerCase()
    .replace(/[,$]/g, ' ')
    .replace(/[\u2013\u2014-]/g, ' ')
    .replace(/[^a-z0-9./%]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return false;

  return tokens.every((token) => {
    if (/^\d+([./]\d+)?%?$/.test(token)) return true;
    if (NUMBER_WORDS.has(token)) return true;
    if (UNITS.has(token.replace(/s$/, ''))) return true;
    if (NUMERIC_SYMBOL_UNITS.has(token)) return true;
    return false;
  });
}

function answerUnit(value) {
  const normalized = String(value ?? '').toLowerCase();
  for (const unit of UNITS) {
    if (new RegExp(`\\b${escapeRegex(unit)}s?\\b`, 'i').test(normalized)) return unit;
  }
  return null;
}

function unitOnly(value) {
  const tokens = tokenize(value);
  return tokens.length > 0 && tokens.every((token) => UNITS.has(token.replace(/s$/, '')));
}

function isIdiomClue(row) {
  return (row.tags ?? []).includes('idioms') || /\bidiom\b/i.test(String(row.clue ?? ''));
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

function normalizeTokens(value) {
  return tokenize(value).filter((token) => !STOP_WORDS.has(token));
}

function containsTokenSequence(tokens, sequence) {
  if (sequence.length === 0 || sequence.length > tokens.length) return false;
  for (let index = 0; index <= tokens.length - sequence.length; index += 1) {
    if (sequence.every((token, offset) => tokens[index + offset] === token)) return true;
  }
  return false;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOP_WORDS = new Set('a an the of in on at to for from with by and or as this that these those is are was were be been being it its his her their into over after before under during about who what when where why how which one ones man woman men women people person thing things first last new old great greater little big small'.split(' '));
const IMPORTANT_SHORT_WORDS = new Set(['rome', 'mars', 'zeus', 'hera', 'odin', 'thor', 'java', 'ruby', 'perl', 'ford', 'nile', 'yale', 'duke', 'jazz']);
const ALLOWED_CLASS_WORDS = new Set('answer award battle book capital category city country empire film game lake line museum novel number opera person place play poem prize river scale song state team telescope term treaty unit war word work'.split(' '));
const UNITS = new Set('year month day hour minute second mile kilometer kilometre meter metre foot feet inch pound ounce gram ton percent degree point run game book volume'.split(' '));
// Generic geographic/political nouns — allowed to share a stem with the answer
// (e.g. "Ocean" in "Southern Ocean") without being flagged as a stem leak.
const GEO_GENERIC = new Set('ocean oceans sea seas lake lakes river rivers gulf strait sound island islands mountain mountains mount range ranges desert deserts peninsula plateau republic kingdom state states city cities province county country countries channel plain valley coast shore region regions sound bay'.split(' '));
const NUMERIC_SYMBOL_UNITS = new Set(['ft', 'mph', 'km', 'kg', 'hz', 'khz', 'mhz', 'ghz']);
const NUMBER_WORDS = new Set('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion'.split(' '));
