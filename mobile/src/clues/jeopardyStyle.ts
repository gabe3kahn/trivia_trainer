import type { RecommendedQuestion } from '@/src/types/supabase';

export function displayClue(question: RecommendedQuestion) {
  const clue = question.clue.trim();
  if (!clue.endsWith('?')) return clue;

  const withoutQuestion = clue.replace(/\?+$/, '.');
  const transforms: Array<[RegExp, string]> = [
    [/^what is the name of (.+)\.$/i, 'This is the name of $1.'],
    [/^what is (.+)\.$/i, 'This is $1.'],
    [/^who is (.+)\.$/i, 'This person is $1.'],
    [/^who was (.+)\.$/i, 'This person was $1.'],
    [/^who (.+)\.$/i, 'This person $1.'],
    [/^which (.+)\.$/i, 'This $1.'],
    [/^where is (.+)\.$/i, 'This place is where $1.'],
    [/^when was (.+)\.$/i, 'This is when $1.'],
    [/^when did (.+)\.$/i, 'This is when $1.'],
  ];

  for (const [pattern, replacement] of transforms) {
    if (pattern.test(withoutQuestion)) {
      return withoutQuestion.replace(pattern, replacement);
    }
  }

  return withoutQuestion;
}
