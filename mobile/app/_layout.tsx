import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/src/contexts/AuthContext';

// Apply OTA updates automatically instead of the default "downloads now, applies on the
// NEXT cold start" behavior (which is why an update took two force-quits to appear). On
// launch and when returning to the foreground, check → download → reload into the new
// bundle in one go. Dev builds / Expo Go have Updates disabled, so this is a no-op there.
function useOtaAutoReload() {
  const busy = useRef(false);
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const apply = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // offline / no update / mid-download — leave the current bundle running
      } finally {
        busy.current = false;
      }
    };
    void apply();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void apply();
    });
    return () => sub.remove();
  }, []);
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  useOtaAutoReload();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="custom-run" options={{ headerShown: false }} />
          <Stack.Screen name="activity" options={{ headerShown: false }} />
          <Stack.Screen name="badges" options={{ headerShown: false }} />
          <Stack.Screen name="duel/[id]" options={{ title: 'Duel', headerBackButtonDisplayMode: 'minimal' }} />
          <Stack.Screen name="duel/new" options={{ presentation: 'modal', title: 'New duel' }} />
          <Stack.Screen name="duel/history" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
