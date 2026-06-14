import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper around expo-haptics. Every call is wrapped so a platform that
 * doesn't support haptics (web, some Android) silently no-ops instead of
 * throwing. Use these instead of importing expo-haptics directly.
 */

export function tapLight() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tapMedium() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function notifySuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function notifyWarning() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

export function notifyError() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
