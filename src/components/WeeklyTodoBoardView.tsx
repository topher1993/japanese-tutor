// Presentational view of a WeeklyTodoBoard for the Lessons screen. It receives
// a board plus one routing callback; all supported todo kinds are wired by the
// parent while this component stays free of navigation state.
//
// The next-week gate (isWeekUnlocked) is owned by LessonsScreen, not here —
// this component is just the board, not the gate.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeeklyTodoBoard, TodoCtaRoute } from '../services/weeklyTodoService';
import type { WeekTodoKind } from '../types/weeklyTodo';
import { Card } from './Card';
import { ds } from '../theme/designSystem';

export interface WeeklyTodoBoardViewProps {
  board: WeeklyTodoBoard;
  onTodoPress: (ctaRoute: TodoCtaRoute) => void;
}

const LEGACY_HELPER = 'Completed before weekly todos were introduced';

export function WeeklyTodoBoardView({ board, onTodoPress }: WeeklyTodoBoardViewProps) {
  const isLegacy = board.isLegacyWeek;
  const progressLabel = isLegacy
    ? LEGACY_HELPER
    : `${board.completedCount} / ${board.totalCount} complete`;

  return (
    <Card shadow="card">
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>Week {board.weekNumber} todos</Text>
        <Text style={styles.progress} numberOfLines={1}>{progressLabel}</Text>
      </View>
      {isLegacy ? (
        <Text style={styles.legacyHelper}>{LEGACY_HELPER}</Text>
      ) : board.todos.length === 0 ? (
        <Text style={styles.emptyHelper}>No todos for this week yet.</Text>
      ) : (
        <View style={styles.list}>
          {board.todos.map(status => (
            <WeeklyTodoRow key={status.todo.id} status={status} onPress={onTodoPress} />
          ))}
        </View>
      )}
    </Card>
  );
}

interface WeeklyTodoRowProps {
  status: WeeklyTodoBoard['todos'][number];
  onPress: (ctaRoute: TodoCtaRoute) => void;
}

// Phase 47: every WeekTodoKind value is wired — the CTA routes for all 6
// kinds come from `weeklyTodoService.ctaRouteForTodo` and the parent
// (LessonsScreen) handles each ctaRoute.screen. If you add a new kind to
// `src/types/weeklyTodo.ts`, add it here too — the regression test
// `tests/phase47WeeklyTodoBoardWiring.test.ts` will catch a miss.
const WIRED_TODO_KINDS: ReadonlySet<WeekTodoKind> = new Set<WeekTodoKind>([
  'lesson',
  'flashcards',
  'daily-rush',
  'quiz',
  'kanji',
  'example-sentences',
]);

function WeeklyTodoRow({ status, onPress }: WeeklyTodoRowProps) {
  // Phase 47: all 6 WeekTodoKind values are tappable (the parent
  // LessonsScreen.switch on ctaRoute.screen handles the 6 -> AppTab /
  // showDailyRush mapping). Completed `lesson` todos stay tappable so the
  // learner can review the lesson again — mirroring the Continue-lesson
  // CTA which routes to any lesson (done or not) once the course/week is
  // complete.
  const isWired = WIRED_TODO_KINDS.has(status.todo.kind);
  const ctaLabel = status.completed && isWired
    ? 'Review'
    : isWired
      ? 'Open'
      : 'Coming soon';
  const enabled = isWired;
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{status.todo.title}</Text>
        <Text style={styles.rowHelper} numberOfLines={2}>{status.helperText}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled }}
        onPress={enabled ? () => onPress(status.ctaRoute) : undefined}
        disabled={!enabled}
        style={({ pressed }) => [
          styles.cta,
          { opacity: !enabled ? 0.5 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.ctaLabel}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ds.spacing.sm,
    marginBottom: ds.spacing.sm,
  },
  title: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  progress: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, flexShrink: 1, maxWidth: '60%', textAlign: 'right' },
  legacyHelper: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18 },
  emptyHelper: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18 },
  list: { gap: ds.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    backgroundColor: ds.colors.surfaceAlt,
    padding: ds.spacing.sm,
    borderRadius: ds.radius.md,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  rowHelper: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, flexShrink: 1, lineHeight: 18 },
  cta: {
    paddingHorizontal: ds.spacing.md,
    paddingVertical: ds.spacing.xs,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.colors.brandSoft,
    minHeight: ds.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandDark },
});
