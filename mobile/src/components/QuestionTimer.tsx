import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, type } from '@/src/theme';

/**
 * Per-question countdown for the Daily Challenge. Counts from `seconds` to 0 while
 * `running`, and calls `onExpire` exactly once at zero (the screen then auto-submits
 * a no-answer). Changing `questionKey` restarts it for the next question. The bar
 * shifts teal → gold → red as time runs low.
 */
export function QuestionTimer({
  seconds = 30,
  running = true,
  questionKey,
  onExpire,
}: {
  seconds?: number;
  running?: boolean;
  questionKey: string | number;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const fired = useRef(false);

  // Reset whenever the question (or limit) changes.
  useEffect(() => {
    setRemaining(seconds);
    fired.current = false;
  }, [questionKey, seconds]);

  // Tick from a fixed start time so it stays accurate across re-renders.
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, seconds - (Date.now() - start) / 1000);
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        onExpire?.();
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey, running, seconds]);

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100));
  const tone = remaining <= 5 ? colors.red : remaining <= 10 ? colors.gold : colors.teal;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone }]} />
      </View>
      <Text style={[styles.label, { color: tone }]}>{Math.ceil(remaining)}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill },
  label: { ...type.caption, minWidth: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
