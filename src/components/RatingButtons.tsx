import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ds } from '../theme/designSystem';

// SM-2 spaced-repetition rating buttons. The dominant UI of the flashcard screen.
// Four big buttons in a row, each with a distinct but harmonious color.
// Each rating has a different haptic intensity — "Again" feels heavier than "Easy".

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface RatingButtonsProps {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
  dueCount?: number;
  /** Disable haptic feedback (e.g. on web). */
  disableHaptics?: boolean;
}

const RATING_META: Record<Rating, { label: string; bg: string; key: string; haptic: 'heavy' | 'medium' | 'light' | 'soft' }> = {
  again: { label: 'Again',  bg: ds.colors.danger,  key: '😣', haptic: 'heavy' },
  hard:   { label: 'Hard',   bg: ds.colors.warm,    key: '🤔', haptic: 'medium' },
  good:   { label: 'Good',   bg: ds.colors.success, key: '🙂', haptic: 'light' },
  // Phase 49 Beru pedagogy review: Easy was 'soft' (selectionAsync) which
  // is so subtle some devices miss it. Bumped to 'light' (impactAsync Light)
  // so the button always confirms the tap — without inflating the ease
  // bump that Easy already gives via the SM-2 algorithm.
  easy:   { label: 'Easy',   bg: ds.colors.brand,   key: '😎', haptic: 'light' },
};

function fireHaptic(intensity: 'heavy' | 'medium' | 'light' | 'soft') {
  try {
    switch (intensity) {
      case 'heavy':  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); break;
      case 'light':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); break;
      case 'soft':   Haptics.selectionAsync().catch(() => {}); break;
    }
  } catch {
    /* ignore on web */
  }
}

export function RatingButtons({ onRate, disabled = false, dueCount, disableHaptics }: RatingButtonsProps) {
  return (
    <View style={styles.shell}>
      {dueCount !== undefined ? (
        <View style={styles.header}>
          <Text style={styles.headerLabel}>How well did you know it?</Text>
          <Text style={styles.headerCount}>{dueCount} due today</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        {(['again', 'hard', 'good', 'easy'] as Rating[]).map(rating => {
          const meta = RATING_META[rating];
          return (
            <Pressable
              key={rating}
              disabled={disabled}
              onPress={() => {
                if (!disableHaptics) fireHaptic(meta.haptic);
                onRate(rating);
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: meta.bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.emoji}>{meta.key}</Text>
              <Text style={styles.label}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: ds.spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  headerLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.textMuted, textTransform: 'uppercase' },
  headerCount: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary },
  row: { flexDirection: 'row', gap: ds.spacing.xs },
  btn: {
    flex: 1,
    minHeight: ds.touch.comfortable,
    paddingVertical: ds.spacing.sm,
    borderRadius: ds.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ds.spacing.xs,
    ...ds.shadow.card,
  },
  emoji: { fontSize: 22 },
  label: { fontSize: ds.type.caption, fontWeight: '900', color: '#fff' },
});