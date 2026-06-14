import { StyleSheet, Text, View } from 'react-native';

import { Header, Pill, Screen, Section } from '@/src/components/ui';
import { colors, radius, spacing, type } from '@/src/theme';

export default function SocialScreen() {
  return (
    <Screen>
      <Header kicker="Social" title="Crossplay" right={<Pill tone="teal">future</Pill>} />

      <Section title="Later, not MVP">
        <FutureRow title="Turn-based match" detail="Answer a board, send it, then compare after both players finish." label="Future" />
        <FutureRow title="Category draft" detail="Pick strengths, attack weaknesses, rematch like async word games." label="Idea" />
        <FutureRow title="Unique gets" detail="See which clues only you knew after the round resolves." label="+3" />
      </Section>

      <Section title="Design targets">
        <FutureRow title="Friend games" detail="Asynchronous, low-pressure, resumable rounds." label="async" />
        <FutureRow title="Rematches" detail="One-tap revenge rounds from the same category mix." label="planned" />
        <FutureRow title="Nudges" detail="Gentle reminders without making the app noisy." label="planned" />
      </Section>
    </Screen>
  );
}

function FutureRow({ title, detail, label }: { title: string; detail: string; label: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Pill tone="teal">{label}</Pill>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  rowDetail: {
    ...type.caption,
    color: colors.muted,
  },
});
