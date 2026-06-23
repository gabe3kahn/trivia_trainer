import { describe, expect, it } from 'vitest';

import { gradeResponse, normalizeAnswer } from './answerGrader';
import type { RecommendedQuestion } from '@/src/types/supabase';

// The grader only reads answer / aliases / answer_detail; everything else on
// RecommendedQuestion is irrelevant to scoring, so build a minimal stub.
function q(answer: string, aliases: string[] = [], answer_detail?: string): RecommendedQuestion {
  return { answer, aliases, answer_detail } as unknown as RecommendedQuestion;
}

type Grade = 'correct' | 'missed' | 'unknown';
type Case = { name: string; answer: string; aliases?: string[]; submitted: string; want: Grade };

// Every reported mis-grade should land here as a permanent row. Grading is pure +
// deterministic, so this table is the contract. When a bug is reported, add the row
// (red) before fixing (green).
const cases: Case[] = [
  // ---- exact + normalization ----
  { name: 'exact match', answer: 'Paris', submitted: 'Paris', want: 'correct' },
  { name: 'case-insensitive', answer: 'Paris', submitted: 'PARIS', want: 'correct' },
  { name: 'diacritics ignored (Rhone=Rhône)', answer: 'Rhône', submitted: 'Rhone', want: 'correct' },
  { name: 'diacritics ignored (Beyonce)', answer: 'Beyoncé', submitted: 'beyonce', want: 'correct' },
  { name: 'leading article dropped (the Beatles)', answer: 'The Beatles', submitted: 'Beatles', want: 'correct' },
  { name: 'question prefix stripped (what is)', answer: 'Nile', submitted: 'what is the Nile', want: 'correct' },
  { name: 'question prefix stripped (who was)', answer: 'Napoleon', submitted: 'Who was Napoleon?', want: 'correct' },
  { name: 'ampersand = and', answer: 'Salt and Pepper', submitted: 'Salt & Pepper', want: 'correct' },
  { name: 'punctuation ignored', answer: 'Romeo and Juliet', submitted: 'romeo & juliet!', want: 'correct' },

  // ---- empty / no answer ----
  { name: 'empty submission is unknown', answer: 'Paris', submitted: '', want: 'unknown' },
  { name: 'whitespace-only is unknown', answer: 'Paris', submitted: '   ', want: 'unknown' },

  // ---- aliases ----
  { name: 'alias match (JFK)', answer: 'John F. Kennedy', aliases: ['JFK'], submitted: 'jfk', want: 'correct' },
  { name: 'alias match (Nike of Samothrace)', answer: 'Winged Victory of Samothrace', aliases: ['Nike of Samothrace', 'Winged Victory'], submitted: 'Nike of Samothrace', want: 'correct' },
  { name: 'common-name alias (Winged Victory)', answer: 'Winged Victory of Samothrace', aliases: ['Nike of Samothrace', 'Winged Victory'], submitted: 'Winged Victory', want: 'correct' },

  // ---- typos / fuzzy on longer answers ----
  { name: 'typo within tolerance (Massachusets)', answer: 'Massachusetts', submitted: 'Massachusets', want: 'correct' },
  { name: 'token containment, submitted is longer', answer: 'Huckleberry Finn', submitted: 'Adventures of Huckleberry Finn', want: 'correct' },
  { name: 'token containment, submitted is shorter', answer: 'New York', submitted: 'New York City', want: 'correct' },

  // ---- short-answer guards: a tiny edit lands on a DIFFERENT real word ----
  { name: 'equal-length substitution rejected (Rhine≠Rhône)', answer: 'Rhône', submitted: 'Rhine', want: 'missed' },
  { name: 'equal-length substitution rejected (Mark≠Mars)', answer: 'Mars', submitted: 'Mark', want: 'missed' },
  { name: 'changed initial rejected (hone≠Rhône)', answer: 'Rhône', submitted: 'hone', want: 'missed' },
  { name: 'whole-token only — Indochina≠China', answer: 'China', submitted: 'Indochina', want: 'missed' },
  { name: 'no substring credit — comparison≠Paris', answer: 'Paris', submitted: 'comparison', want: 'missed' },

  // ---- numbers ----
  { name: 'word=digit numeric equivalence (7=Seven)', answer: 'Seven', submitted: '7', want: 'correct' },
  { name: 'different year rejected (1985≠1984)', answer: '1984', submitted: '1985', want: 'missed' },

  // ---- surname shortcut (people) ----
  { name: 'bare surname accepted (Pollock)', answer: 'Jackson Pollock', submitted: 'Pollock', want: 'correct' },
  { name: 'misspelled surname within 1 edit (Pollack)', answer: 'Jackson Pollock', submitted: 'Pollack', want: 'correct' },
  { name: 'wrong surname rejected (Smith)', answer: 'Jackson Pollock', submitted: 'Smith', want: 'missed' },
  { name: 'short surname not accepted alone (Lee)', answer: 'Stan Lee', submitted: 'Lee', want: 'missed' },

  // ---- REGRESSION: surname shortcut must not fire for a multi-word phrase that merely
  //      ENDS in the surname. "Winged Victory" alias previously accepted anything ending
  //      in "victory" -> "winged horse of victory" was scored correct. (Reported 2026-06-22.)
  { name: 'phrase ending in surname-word rejected (winged horse of victory)', answer: 'Winged Victory of Samothrace', aliases: ['Nike of Samothrace', 'Winged Victory'], submitted: 'winged horse of victory', want: 'missed' },
  { name: 'unrelated phrase ending in shared word rejected', answer: 'Jackson Pollock', submitted: 'someone named Pollock the painter', want: 'missed' },
];

describe('gradeResponse', () => {
  it.each(cases)('$name', ({ answer, aliases, submitted, want }) => {
    expect(gradeResponse(q(answer, aliases ?? []), submitted).grade).toBe(want);
  });

  it('returns the reveal (answer_detail) on a correct visual clue', () => {
    const r = gradeResponse(q('Mona Lisa', [], 'Mona Lisa — Leonardo da Vinci'), 'mona lisa');
    expect(r.grade).toBe('correct');
    expect(r.detail).toBe('Mona Lisa — Leonardo da Vinci');
  });
});

describe('normalizeAnswer', () => {
  it.each([
    ['The   PARIS!', 'paris'],
    ['What was the Battle of Hastings', 'battle of hastings'],
    ['Salt & Pepper', 'salt and pepper'],
    ['Beyoncé', 'beyonce'],
    ['  trailing spaces trimmed  ', 'trailing spaces trimmed'],
  ])('normalizes %j -> %j', (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });
});
