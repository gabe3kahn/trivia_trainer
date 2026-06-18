import { Platform, type TextStyle } from 'react-native';

/**
 * Design tokens for Trivia Trainer.
 *
 * Principles after the redesign:
 * - One brand accent (gold). Teal/green/red/blue/purple are reserved for
 *   semantic state only (correct / close / missed / info / mechanic).
 * - A real type ramp. Weight 800 is for hero numbers and titles only; body
 *   text is 500, labels 600. Nothing else should reach for 900.
 * - Soft, consistent corners (radius.md = 14) and breathing room (spacing.md = 16).
 */

export const colors = {
  // Base surfaces — a calmer, slightly warm navy rather than pure black.
  background: '#0B0B14',
  surface: '#14141F',
  surfaceAlt: '#1C1C2B',
  elevated: '#191926',

  // Text ramp.
  ink: '#F4F6FB',
  muted: '#9AA0B4',
  dim: '#5A6076',

  // Hairlines.
  line: '#262638',
  lineSoft: '#1E1E2C',

  // Brand accent.
  gold: '#F2B84B',
  goldSoft: '#33260F',

  // Semantic state colors (use sparingly, with intent).
  teal: '#2DD4BF',
  tealSoft: '#123431',
  green: '#34D399',
  greenSoft: '#10342A',
  red: '#FB7185',
  redSoft: '#36161F',
  blue: '#60A5FA',
  blueSoft: '#16273F',
  purple: '#A78BFA',
  purpleSoft: '#221A3D',

  // Jeopardy clue board — themed instead of inline hex.
  board: '#0E1B6B',
  boardEdge: '#3148D6',
  boardInk: '#FFFFFF',
  boardMeta: '#AEC0FF',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Typography presets. Spread one into a style:  ...type.heading
 * Each carries size + lineHeight + weight so callers stop hand-rolling them.
 */
export const type: Record<string, TextStyle> = {
  display: { fontSize: 32, lineHeight: 37, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 29, fontWeight: '800' },
  heading: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  /** All-caps micro-label. The ONLY place uppercase + letterSpacing belongs. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

/** Tier → accent color, shared by rings, bars, and badges. */
export function scoreColor(score: number) {
  if (score >= 90) return colors.blue;
  if (score >= 75) return colors.green;
  if (score >= 60) return colors.teal;
  if (score >= 40) return colors.gold;
  return colors.red;
}

/**
 * Serif face for clue text — gives clues an editorial/quiz feel (distinct from
 * the game-show look) without bundling a font file. Georgia ships on iOS.
 */
export const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

/**
 * Per-category accent. Drives the clue card's color identity (rail + label +
 * difficulty pips) and category chips. Falls back to gold for anything unmapped.
 */
export const categoryColor: Record<string, string> = {
  history: '#E0973A',
  geography: '#34D399',
  science: '#2DD4BF',
  arts_visual_culture: '#A78BFA',
  literature_books: '#FB7185',
  music_performing_arts: '#F472B6',
  language_wordplay: '#60A5FA',
  pop_culture_media_modern_life: '#FB923C',
  religion_mythology_philosophy: '#818CF8',
  sports_games_leisure: '#A3E635',
};

export function accentFor(categoryId?: string | null) {
  return (categoryId && categoryColor[categoryId]) || colors.gold;
}

/** Difficulty rank (1–5) → short tier word, shown next to the pips. */
export function difficultyTier(rank: number) {
  return ['—', 'Easy', 'Medium', 'Hard', 'Expert', 'Master'][Math.max(0, Math.min(5, Math.round(rank)))];
}
