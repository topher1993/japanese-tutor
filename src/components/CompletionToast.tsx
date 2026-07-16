import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ds } from '../theme/designSystem';

/**
 * Phase 30 — In-app completion toast.
 *
 * The user wanted a notification when a lesson is finished. `expo-notifications`
 * is not yet installed (flagged as Phase 3 / deferred in
 * docs/phase28-user-profile-qc.md), so we surface the completion feedback
 * in-app via a short auto-dismissing toast instead of a real push.
 *
 * Usage:
 *   1. Mount `<CompletionToast />` once near the screen root.
 *   2. Import `notifyLessonCompleted` and call it from the lesson-complete
 *      button's onPress.
 */
const listeners = new Set<(payload: ToastPayload) => void>();
const errorListeners = new Set<(payload: LessonErrorPayload) => void>();

export interface ToastPayload {
  message: string;
  detail?: string;
  tone?: 'success' | 'info';
}

export function notifyLessonCompleted(payload: ToastPayload): void {
  for (const listener of listeners) listener(payload);
}

// Phase 39 (Igris mark-complete fix) — structured error channel mirrored
// from notifyLessonCompleted. Two error kinds:
//
//   - 'store-unavailable': the handler was reached before the practice
//     progress store had resolved. Should be rare because the Button is
//     disabled while !store, but a hot-reload could land a tap in this
//     window. Surface it so the user knows the tap didn't land silently.
//
//   - 'completion-failed': the store call (completeCurrentLesson) threw.
//     The pre-fix handler swallowed this in `catch {}`. The toast now
//     shows the error so the user can retry or report it.
export type LessonErrorPayload =
  | { kind: 'store-unavailable'; lessonId: string }
  | { kind: 'completion-failed'; lessonId: string; error: string };

export function notifyLessonError(payload: LessonErrorPayload): void {
  for (const listener of errorListeners) listener(payload);
}

// Optional user-facing label helpers. Kept here so all error presentation
// lives next to the bus definition.
function errorToMessage(payload: LessonErrorPayload): string {
  if (payload.kind === 'store-unavailable') {
    return 'Could not mark lesson complete';
  }
  return 'Could not mark lesson complete';
}

function errorToDetail(payload: LessonErrorPayload): string {
  if (payload.kind === 'store-unavailable') {
    return 'Storage is still loading. Please retry in a moment.';
  }
  return payload.error;
}

export function CompletionToast() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPayload = (next: ToastPayload) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      opacity.stopAnimation();
      translateY.stopAnimation();
      setPayload(next);
      // Reset to invisible, then animate in.
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      // Auto-hide after 3.5s.
      hideTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 220, useNativeDriver: true }),
        ]).start(() => setPayload(null));
        hideTimerRef.current = null;
      }, 3500);
    };
    listeners.add(onPayload);
    return () => {
      listeners.delete(onPayload);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [opacity, translateY]);

  if (!payload) return null;

  const tone = payload.tone ?? 'success';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY }] },
        tone === 'success' ? styles.success : styles.info,
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{tone === 'success' ? '✓' : 'ℹ'}</Text>
        <View style={styles.textWrap}>
          <Text style={styles.message} numberOfLines={2}>{payload.message}</Text>
          {payload.detail ? (
            <Text style={styles.detail} numberOfLines={2}>{payload.detail}</Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

// Phase 39 (Igris mark-complete fix) — error counterpart to
// CompletionToast. Subscribes to notifyLessonError via the same
// subscribe-and-publish pattern (with its own listener set so a
// success toast cannot suppress an error toast and vice versa).
// Auto-dismisses after ~3s. Returns null when no error is in flight.
export function LessonErrorToast() {
  const [payload, setPayload] = useState<LessonErrorPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPayload = (next: LessonErrorPayload) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      opacity.stopAnimation();
      translateY.stopAnimation();
      setPayload(next);
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      hideTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 220, useNativeDriver: true }),
        ]).start(() => setPayload(null));
        hideTimerRef.current = null;
      }, 3000);
    };
    errorListeners.add(onPayload);
    return () => {
      errorListeners.delete(onPayload);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [opacity, translateY]);

  if (!payload) return null;
  const message = errorToMessage(payload);
  const detail = errorToDetail(payload);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="assertive"
      style={[
        styles.wrap,
        styles.error,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>!</Text>
        <View style={styles.textWrap}>
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
          <Text style={styles.detail} numberOfLines={2}>{detail}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: ds.spacing.lg,
    left: ds.spacing.md,
    right: ds.spacing.md,
    paddingVertical: ds.spacing.sm,
    paddingHorizontal: ds.spacing.md,
    borderRadius: ds.radius.md,
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  success: { backgroundColor: ds.colors.successSoft ?? ds.colors.surface },
  info: { backgroundColor: ds.colors.brandSoft ?? ds.colors.surface },
  error: { backgroundColor: ds.colors.dangerSoft ?? '#fde2e2' },
  row: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  icon: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.primary },
  textWrap: { flex: 1, minWidth: 0 },
  message: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  detail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: 2, flexShrink: 1 },
});
