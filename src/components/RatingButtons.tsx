import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ds } from '../theme/designSystem';
import { Mascot, type MascotExpression } from './Mascot';

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

interface RatingMeta {
  label: string;
  bg: string;
  expression: MascotExpression;
  haptic: 'heavy' | 'medium' | 'light' | 'soft';
}

// Phase 51 / Chris request 2026-07-09: replace the emoji `key` rendered
// above each rating label with a small Kō mascot illustration. Kō is the
// project's chibi samurai mascot and already has 5 expressions
// (base | happy | thinking | celebrate | encourage) — the same character
// used in the post-rating feedback block further down. This unifies the
// visual language between the rating prompt and the feedback, and
// removes the inconsistent emoji-style glyphs that mixed with the
// Japanese-tutor design system.
//
// Expression mapping rationale:
//   again  → thinking   (puzzled — "we'll see this again soon")
//   hard   → encourage  (gentle fist-clench — "push through")
//   good   → happy      (standard success)
//   easy   → celebrate  (rock-stars the perfect-recall bump SM-2 gives)
//
// We render at size={56} (matching HomeScreen's 56 / LessonsScreen's 56
// usage) so the chibi samurai is recognisable on a 360dp-wide screen
// — at smaller sizes the PNG's transparent margin dominates the visual.
// Each button grows to ~88dp tall to fit the 56×84dp portrait mascot.
const RATING_META: Record<Rating, RatingMeta> = {
  again: { label: 'Again', bg: ds.colors.danger, expression: 'thinking', haptic: 'heavy' },
  hard:   { label: 'Hard',  bg: ds.colors.warm,   expression: 'encourage', haptic: 'medium' },
  good:   { label: 'Good',  bg: ds.colors.success, expression: 'happy', haptic: 'light' },
  // Phase 49 Beru pedagogy review: Easy was 'soft' (selectionAsync) which
  // is so subtle some devices miss it. Bumped to 'light' (impactAsync Light)
  // so the button always confirms the tap — without inflating the ease
  // bump that Easy already gives via the SM-2 algorithm.
  easy:   { label: 'Easy',  bg: ds.colors.brand,  expression: 'celebrate', haptic: 'light' },
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
              accessibilityRole="button"
              accessibilityLabel={`${meta.label} review rating`}
              accessibilityState={{ disabled }}
              onPress={() => {
                if (!disableHaptics) fireHaptic(meta.haptic);
                onRate(rating);
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: meta.bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Mascot expression={meta.expression} size={56} />
              <Text style={styles.label}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.tooltip}>Good = saw it, knew it.  Easy = instant.</Text>
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
      // Phase 51 / Chris request: Kō mascot (56×84 portrait) sits above the
      // label, so the button needs ~88dp min height to keep both visible.
      // Default design-system touch target (56) would clip the helmet.
      minHeight: 88,
      paddingVertical: ds.spacing.sm,
      paddingHorizontal: ds.spacing.xs,
      borderRadius: ds.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: ds.spacing.xs,
      ...ds.shadow.card,
    },
  emoji: { fontSize: 22 },
  label: { fontSize: ds.type.caption, fontWeight: '900', color: '#fff' },
  tooltip: { fontSize: ds.type.caption, color: ds.colors.textMuted, textAlign: 'center', opacity: 0.85 },
});
