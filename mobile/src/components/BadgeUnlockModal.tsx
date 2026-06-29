import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { badgeIcon, tierColor as tierColorFor } from '@/src/constants/badges';
import { colors, radius, spacing, type } from '@/src/theme';
import type { Database } from '@/src/types/supabase';

type Badge = Database['public']['Tables']['badges']['Row'];

/**
 * Celebratory modal shown when the player earns a new badge. Driven by a queue
 * (useBadgeUnlock) so multiple badges earned at once are shown one at a time.
 */
export function BadgeUnlockModal({ badge, onDismiss }: { badge: Badge | null; onDismiss: () => void }) {
  const tier = badge?.tier ?? 'bronze';
  const tierColor = tierColorFor(tier);

  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        {badge ? (
          <View style={[styles.card, { borderColor: tierColor }]}>
            <View style={[styles.glow, { backgroundColor: tierColor }]} pointerEvents="none" />

            <Text style={[styles.kicker, { color: tierColor }]}>★ Badge unlocked</Text>

            <View style={[styles.iconWrap, { borderColor: tierColor, backgroundColor: tierColor + '22' }]}>
              <Text style={styles.icon}>{badgeIcon(badge.key)}</Text>
            </View>

            <Text style={styles.name}>{badge.name}</Text>

            <View style={[styles.tierPill, { borderColor: tierColor }]}>
              <Text style={[styles.tierText, { color: tierColor }]}>{tier.toUpperCase()}</Text>
            </View>

            <Text style={styles.desc}>{badge.description}</Text>

            <Pressable onPress={onDismiss} style={[styles.btn, { borderColor: tierColor }]}>
              <Text style={[styles.btnText, { color: tierColor }]}>Nice!</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.xl ?? 24,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: { position: 'absolute', top: -70, alignSelf: 'center', width: 200, height: 200, borderRadius: 100, opacity: 0.12 },
  kicker: { ...type.overline, fontWeight: '800', letterSpacing: 2, marginBottom: spacing.md },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: { fontSize: 40 },
  name: { ...type.title, color: colors.ink, textAlign: 'center' },
  tierPill: { borderWidth: 1, borderRadius: radius.pill ?? 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  desc: { ...type.caption, color: colors.muted, textAlign: 'center', marginTop: spacing.md, lineHeight: 19 },
  btn: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
});
