import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/src/services/supabase';

const ONBOARDING_KEY = 'hasSeenOnboarding';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Whether the first-run onboarding has been completed (persisted in AsyncStorage). */
  hasSeenOnboarding: boolean;
  markOnboardingSeen: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // null = still reading from storage; the gate waits on this so the tabs don't
  // flash before we know whether to show onboarding.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        if (!cancelled) setOnboardingSeen(value === 'true');
      })
      .catch(() => {
        // Storage unreadable — treat as seen so we never trap the user pre-tabs.
        if (!cancelled) setOnboardingSeen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function handleAuthUrl(url: string | null) {
      if (!url) return;

      const params = authParamsFromUrl(url);
      const code = params.get('code');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    Linking.getInitialURL().then((url) => {
      handleAuthUrl(url).catch(() => {
        setLoading(false);
      });
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url).catch(() => {
        setLoading(false);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      linkingSubscription.remove();
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    // Hold `loading` until BOTH auth and the onboarding flag have resolved.
    loading: loading || onboardingSeen === null,
    hasSeenOnboarding: onboardingSeen ?? false,
    markOnboardingSeen: async () => {
      setOnboardingSeen(true);
      try {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      } catch {
        // Best-effort; the in-memory flag still dismisses onboarding this session.
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  }), [loading, onboardingSeen, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function authParamsFromUrl(url: string) {
  const params = new URLSearchParams();
  const query = url.split('?')[1]?.split('#')[0];
  const fragment = url.split('#')[1];

  if (query) {
    new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  }

  if (fragment) {
    new URLSearchParams(fragment).forEach((value, key) => params.set(key, value));
  }

  return params;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
