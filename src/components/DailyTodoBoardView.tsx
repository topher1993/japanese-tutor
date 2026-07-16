import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DailyTodoBoard, DailyTodoKind } from '../services/dailyTodoService';
import { Card } from './Card';
import { ds } from '../theme/designSystem';

export function DailyTodoBoardView({
  board,
  onTodoPress,
}: {
  board: DailyTodoBoard;
  onTodoPress?: (kind: DailyTodoKind) => void;
}) {
  return (
    <Card shadow="card">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Daily todos</Text>
        <Text testID="daily-todo-board-progress" style={styles.progress}>{board.completedCount} / {board.totalCount}</Text>
      </View>
      <View style={styles.list}>
        {board.todos.map(status => (
          <View key={status.todo.id} style={styles.row}>
            <View style={[styles.check, status.completed && styles.checkDone]}>
              <Text style={styles.checkLabel}>{status.completed ? '✓' : '○'}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowTitle, status.completed && styles.rowTitleDone]} numberOfLines={1}>
                {status.todo.title}
              </Text>
              <Text testID={`daily-todo-${status.todo.kind}-status`} style={styles.helper}>{status.helperText}</Text>
            </View>
            {onTodoPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${status.completed ? 'Review' : 'Open'} ${status.todo.title}`}
                testID={`daily-todo-${status.todo.kind}-cta`}
                onPress={() => onTodoPress(status.todo.kind)}
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              >
                <Text style={styles.ctaLabel}>{status.completed ? 'Review' : 'Open'}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <Text style={styles.footer}>
        {board.allDone ? 'All daily goals complete — great work!' : 'Finish these focused goals before the day ends.'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds.spacing.sm },
  title: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  progress: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary },
  list: { gap: ds.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, backgroundColor: ds.colors.surfaceAlt, padding: ds.spacing.sm, borderRadius: ds.radius.md },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.colors.surface, borderWidth: 1, borderColor: ds.colors.border },
  checkDone: { backgroundColor: ds.colors.brandSoft, borderColor: ds.colors.primary },
  checkLabel: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.primary },
  copy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: ds.type.body, fontWeight: '800', color: ds.colors.text },
  rowTitleDone: { color: ds.colors.textMuted },
  helper: { marginTop: ds.spacing.xs, fontSize: ds.type.caption, color: ds.colors.textMuted },
  footer: { marginTop: ds.spacing.sm, fontSize: ds.type.caption, color: ds.colors.textMuted },
  cta: { minHeight: ds.touch.min, paddingHorizontal: ds.spacing.md, borderRadius: ds.radius.pill, backgroundColor: ds.colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.82 },
  ctaLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandDark },
});
