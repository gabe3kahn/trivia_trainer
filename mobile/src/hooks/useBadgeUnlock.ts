import { useCallback, useRef, useState } from 'react';

import { fetchBadges, fetchEarnedBadges } from '@/src/services/triviaApi';
import type { Database } from '@/src/types/supabase';

type Badge = Database['public']['Tables']['badges']['Row'];

/**
 * Detects newly-earned badges and queues them for a celebration modal.
 *
 * Mirrors the fitness_tracker level-up detector: an in-memory ref of "seen" badge
 * keys is initialized SILENTLY on the first check (so already-earned badges never
 * re-celebrate on launch), then any keys that appear afterward — i.e. earned during
 * this app session — get queued. `check()` is cheap and meant to run on Home focus.
 * Multiple badges earned at once are shown one at a time via the queue.
 */
export function useBadgeUnlock() {
  const [queue, setQueue] = useState<Badge[]>([]);
  const seenRef = useRef<Set<string> | null>(null);

  const check = useCallback(async () => {
    try {
      const [earnedRaw, allRaw] = await Promise.all([fetchEarnedBadges(), fetchBadges()]);
      const earned = (earnedRaw ?? []) as { badge_key: string }[];
      const all = (allRaw ?? []) as Badge[];
      const earnedKeys = earned.map((e) => e.badge_key);

      // First load this session: remember what's already earned, celebrate nothing.
      if (seenRef.current === null) {
        seenRef.current = new Set(earnedKeys);
        return;
      }

      const fresh = earnedKeys.filter((k) => !seenRef.current!.has(k));
      if (fresh.length === 0) return;
      fresh.forEach((k) => seenRef.current!.add(k));

      const byKey = new Map(all.map((b) => [b.key, b]));
      const newBadges = fresh.map((k) => byKey.get(k)).filter((b): b is Badge => Boolean(b));
      if (newBadges.length) setQueue((q) => [...q, ...newBadges]);
    } catch {
      // Best-effort — a failed badge check should never disrupt the screen.
    }
  }, []);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  return { current: queue[0] ?? null, dismiss, check };
}
