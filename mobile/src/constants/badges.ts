import { colors } from '@/src/theme';

export const TIER_COLOR: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: colors.gold,
};

// A little personality per badge key (falls back to a medal).
export const BADGE_ICON: Record<string, string> = {
  cartographer: '🗺️',
  archivist: '📜',
  bookworm: '📚',
  lab_coat: '🥼',
  gallery_guide: '🖼️',
  maestro: '🎼',
  oracle: '🔮',
  wordsmith: '✍️',
  playmaker: '🤾',
  zeitgeist: '📺',
  deep_cut: '💿',
  tournament_ready: '🏆',
  clutch: '🎯',
  renaissance: '🌟',
  board_runner: '🏁',
  comeback: '🔄',
  mechanic: '🔧',
  generalist: '🧠',
  specialist: '🎓',
  regular: '🔥',
};

export const badgeIcon = (key: string) => BADGE_ICON[key] ?? '🏅';
export const tierColor = (tier: string | null | undefined) => TIER_COLOR[tier ?? 'bronze'] ?? colors.gold;
