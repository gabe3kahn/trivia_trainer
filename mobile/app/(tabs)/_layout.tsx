import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { BadgeUnlockProvider } from '@/src/contexts/BadgeUnlockContext';

type IconName = ComponentProps<typeof FontAwesome>['name'];

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <FontAwesome name={name} color={color} size={24} style={{ marginBottom: -2 }} />;
}

export default function TabLayout() {
  const { loading, session, hasSeenOnboarding } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  // First run: show the intro once (flag persisted in AsyncStorage via AuthContext).
  // Cast: typed-routes manifest regenerates for /onboarding when the dev server runs
  // (same pattern the codebase uses for other new routes).
  if (!hasSeenOnboarding) {
    return <Redirect href={'/onboarding' as never} />;
  }

  return (
    <BadgeUnlockProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        // Was `colors.dim` (#5A6076) — too dark to read on the nav. `muted` is the
        // lifted inactive tint from the redesign.
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          // Distinct nav chrome, a step above the page/surface (was `surface`,
          // which read as flat black against the page).
          backgroundColor: colors.nav,
          borderTopColor: colors.line,
          minHeight: 72,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 11,
        },
        // Each screen renders its own in-content title (kicker + display). A
        // native header bar duplicated it and left an awkward gap up top.
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ color }) => <TabIcon name="bullseye" color={color} />,
        }}
      />
      <Tabs.Screen
        name="compete"
        options={{
          title: 'Compete',
          tabBarIcon: ({ color }) => <TabIcon name="trophy" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="user-circle" color={color} />,
        }}
      />
    </Tabs>
    </BadgeUnlockProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
