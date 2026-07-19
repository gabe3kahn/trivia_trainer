/**
 * Wordplay mechanic explainers — surfaced via the "i" info affordance on the
 * clue card (see ClueCard + MechanicInfoModal). Keyed by the raw `mechanic`
 * stored on a question. Only wordplay/constructed mechanics appear here; plain
 * 'standard' clues have no explainer (and show no info chip).
 *
 * Keys match the values authored by the wordplay drafter / seed data
 * (tools/acquisition): anagram, before_after, hidden_word, homophone,
 * crossword_clue, initials, rhyme_time, starts_with, ends_with, contains.
 */
export type MechanicInfo = { name: string; description: string; example: string };

export const MECHANIC_INFO: Record<string, MechanicInfo> = {
  anagram: {
    name: 'Anagram',
    description: 'Rearrange all the given letters to spell the answer.',
    example: 'Rearrange LISTEN → SILENT.',
  },
  before_after: {
    name: 'Before & After',
    description: 'Two clues share a linking word; overlap them into one phrase.',
    example: 'Tony the Tiger + Tony Award → “Tony the Tiger Award.”',
  },
  hidden_word: {
    name: 'Hidden Word',
    description: 'The answer is concealed inside the words of the clue — read across the gaps.',
    example: '“broADCAST live” hides CAST.',
  },
  homophone: {
    name: 'Homophone',
    description: 'The answer sounds like the word described but is spelled differently.',
    example: 'Sounds like “flower” → FLOUR.',
  },
  crossword_clue: {
    name: 'Crossword Clue',
    description: 'A concise definition-style clue; the answer is a single word of the shown length.',
    example: '“Large body of salt water” → SEA.',
  },
  crossword: {
    name: 'Crossword Clue',
    description: 'A concise definition-style clue; the answer is a single word of the shown length.',
    example: '“Large body of salt water” → SEA.',
  },
  initials: {
    name: 'Initials & Abbreviations',
    description: 'The answer is the acronym or abbreviation being described.',
    example: '“Laughing out loud” → LOL.',
  },
  rhyme_time: {
    name: 'Rhyme Time',
    description: 'The answer is a short rhyming phrase that fits the description.',
    example: '“A feline in a topper” → CAT IN A HAT.',
  },
  starts_with: {
    name: 'Starts With',
    description: 'Each part of the answer begins with the given letter or letters.',
    example: 'Given “P”: a red salad vegetable → PEPPER.',
  },
  ends_with: {
    name: 'Ends With',
    description: 'The answer ends with the given letters.',
    example: 'Ends in “-ology”: the study of the mind → PSYCHOLOGY.',
  },
  contains: {
    name: 'Contains',
    description: 'The answer contains the given run of letters.',
    example: 'Contains “ARK”: a place with rides → PARK.',
  },
};

/** Explainer for a mechanic, or null for plain clues (no info chip shown). */
export function mechanicInfo(mechanic?: string | null): MechanicInfo | null {
  if (!mechanic) return null;
  return MECHANIC_INFO[mechanic] ?? null;
}
