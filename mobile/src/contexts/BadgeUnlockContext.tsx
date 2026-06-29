import { usePathname } from 'expo-router';
import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { BadgeUnlockModal } from '@/src/components/BadgeUnlockModal';
import { useBadgeUnlock } from '@/src/hooks/useBadgeUnlock';

/** Lets any screen ask for a badge re-check (e.g. the moment a session finishes). */
const BadgeCheckContext = createContext<() => void>(() => {});
export const useBadgeCheck = () => useContext(BadgeCheckContext);

/**
 * App-wide badge-unlock celebration. Mounted once above the tabs so the modal shows over
 * any screen. Re-checks earned badges on every navigation (tab switch / returning from a
 * session route) and when the app returns to the foreground; screens can also call
 * useBadgeCheck() directly (the in-tab practice flow does, since it never changes route).
 */
export function BadgeUnlockProvider({ children }: PropsWithChildren) {
  const { current, dismiss, check } = useBadgeUnlock();
  const pathname = usePathname();

  useEffect(() => {
    void check();
  }, [pathname, check]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  return (
    <BadgeCheckContext.Provider value={check}>
      {children}
      <BadgeUnlockModal badge={current} onDismiss={dismiss} />
    </BadgeCheckContext.Provider>
  );
}
