import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/contexts/AuthContext';
import { tapMedium } from '@/src/lib/haptics';
import { accentFor, colors, radius, spacing, type } from '@/src/theme';

type IconName = ComponentProps<typeof FontAwesome>['name'];

const FEATURES: { icon: IconName; accent: string; title: string; body: string }[] = [
  {
    icon: 'bullseye',
    accent: colors.gold,
    title: 'Train',
    body: 'Answer clues in a Jeopardy-style format. TriviO tracks your competency per category and serves a mix tuned to you.',
  },
  {
    icon: 'trophy',
    accent: colors.teal,
    title: 'Compete',
    body: 'Play the Daily Challenge, climb the leaderboard, and duel friends head-to-head.',
  },
  {
    icon: 'puzzle-piece',
    accent: accentFor('language_wordplay'),
    title: 'Wordplay',
    body: 'Anagrams, Before & After, crosswords and more. Tap the “i” on any wordplay clue for how that mechanic works — with an example.',
  },
  {
    icon: 'user-circle',
    accent: colors.purple,
    title: 'Profile',
    body: 'See your strengths and weaknesses, streaks, and the badges you’ve unlocked over time.',
  },
];

export default function Onboarding() {
  const { markOnboardingSeen } = useAuth();

  async function start() {
    tapMedium();
    await markOnboardingSeen();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Welcome to</Text>
        <Text style={styles.wordmark}>TriviO</Text>
        <Text style={styles.tagline}>Sharpen your trivia — one clue at a time.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={[styles.featureIcon, { borderColor: f.accent, backgroundColor: f.accent + '22' }]}>
                <FontAwesome name={f.icon} size={20} color={f.accent} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={start} style={styles.cta} accessibilityRole="button">
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: 4 },
  kicker: { ...type.overline, color: colors.gold },
  wordmark: { ...type.display, color: colors.ink, marginTop: 2 },
  tagline: { ...type.body, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg },
  features: { gap: spacing.md },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 3 },
  featureTitle: { ...type.heading, color: colors.ink },
  featureBody: { ...type.body, color: colors.muted },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  cta: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { ...type.bodyStrong, color: colors.background, fontWeight: '800', letterSpacing: 0.5 },
});
