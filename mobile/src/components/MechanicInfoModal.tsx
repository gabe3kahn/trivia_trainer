import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MechanicInfo } from '@/src/constants/mechanics';
import { colors, radius, spacing, type } from '@/src/theme';

/**
 * Explainer for a wordplay mechanic, opened from the "i" chip on the clue card.
 * Visual pattern mirrors BadgeUnlockModal (centered dark card over a scrim), but
 * it's informational — accented in blue (the wordplay/info color) rather than a
 * tier color. `info` null keeps it hidden.
 */
export function MechanicInfoModal({ info, onDismiss }: { info: MechanicInfo | null; onDismiss: () => void }) {
  const accent = colors.blue;
  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        {info ? (
          // Stop taps inside the card from dismissing.
          <Pressable style={[styles.card, { borderColor: accent }]} onPress={() => {}}>
            <View style={[styles.glow, { backgroundColor: accent }]} pointerEvents="none" />

            <Text style={[styles.kicker, { color: accent }]}>Wordplay</Text>
            <Text style={styles.name}>{info.name}</Text>
            <Text style={styles.desc}>{info.description}</Text>

            <View style={[styles.exampleBox, { borderColor: accent + '55' }]}>
              <Text style={[styles.exampleLabel, { color: accent }]}>Example</Text>
              <Text style={styles.exampleText}>{info.example}</Text>
            </View>

            <Pressable onPress={onDismiss} style={[styles.btn, { borderColor: accent }]}>
              <Text style={[styles.btnText, { color: accent }]}>Got it</Text>
            </Pressable>
          </Pressable>
        ) : null}
      </Pressable>
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
  kicker: { ...type.overline, fontWeight: '800', letterSpacing: 2, marginBottom: spacing.sm },
  name: { ...type.title, color: colors.ink, textAlign: 'center' },
  desc: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  exampleBox: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: 4,
  },
  exampleLabel: { ...type.overline },
  exampleText: { ...type.bodyStrong, color: colors.ink, lineHeight: 21 },
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
