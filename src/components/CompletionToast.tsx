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

export interface ToastPayload {
  message: string;
  detail?: string;
  tone?: 'success' | 'info';
}

export function notifyLessonCompleted(payload: ToastPayload): void {
  for (const listener of listeners) listener(payload);
}

export function CompletionToast() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    const onPayload = (next: ToastPayload) => {
      setPayload(next);
      // Reset to invisible, then animate in.
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      // Auto-hide after 3.5s.
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 220, useNativeDriver: true }),
        ]).start(() => setPayload(null));
      }, 3500);
    };
    listeners.add(onPayload);
    return () => { listeners.delete(onPayload); };
  }, [opacity, translateY]);

  if (!payload) return null;

  const tone = payload.tone ?? 'success';
  return (
    <Animated.View
      pointerEvents="none"
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
  row: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  icon: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.primary },
  textWrap: { flex: 1, minWidth: 0 },
  message: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  detail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: 2, flexShrink: 1 },
});