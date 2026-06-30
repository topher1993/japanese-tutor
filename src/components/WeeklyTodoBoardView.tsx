// Phase 37c — Presentational view of a WeeklyTodoBoard for the Lessons screen.
// Pure: receives a board from `weeklyTodoService.buildWeeklyTodoBoard` plus a
// single `onTodoPress` callback. The parent (LessonsScreen) decides what each
// ctaRoute actually does; only the `lesson` kind is wired in 37c, the rest
// render a disabled "Coming soon" CTA until 37d-1..5 lands.
//
// The next-week gate (isWeekUnlocked) is owned by LessonsScreen, not here —
// this component is just the board, not the gate.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeeklyTodoBoard, TodoCtaRoute } from '../services/weeklyTodoService';
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
        <Text style={styles.title}>Week {board.weekNumber} todos</Text>
        <Text style={styles.progress}>{progressLabel}</Text>
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

function WeeklyTodoRow({ status, onPress }: WeeklyTodoRowProps) {
  // 37c: only the `lesson` kind is wired into the existing navigation
  // surface. Every other kind renders as a visible row with a disabled
  // "Coming soon" CTA. 37d-1..5 will swap each in. Completed `lesson`
  // todos stay tappable so the learner can review the lesson again —
  // mirroring the Continue-lesson CTA which routes to any lesson (done
  // or not) once the course/week is complete.
  const isWired = status.todo.kind === 'lesson';
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
  progress: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary },
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
