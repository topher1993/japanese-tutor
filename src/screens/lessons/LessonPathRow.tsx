// Phase 43 — LessonPathRow extracted from LessonsScreen.tsx
//
// Renders a single row in the lesson path list with state badge + title +
// helper + action label. Owns its own styles because no other component
// uses these specific keys (lessonPathRow*).
//
// Phase 43: No state, no hooks, no behavior change. Pure prop-driven
// presentation component.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ds } from '../../theme/designSystem';
import type { LessonPathItem } from '../../services/lessonInteractionPathService';

export function LessonPathRow({ item, onOpen }: { item: LessonPathItem; onOpen: () => void }) {
  const stateLabel = item.state === 'completed' ? 'Completed' : item.state === 'current' ? 'Current' : 'Locked';
  const statusIcon = item.state === 'completed' ? '✓' : item.state === 'current' ? '▶' : '🔒';
  return (
    <Pressable
      onPress={item.state === 'locked' ? undefined : onOpen}
      disabled={item.state === 'locked'}
      style={({ pressed }) => [styles.lessonPathRow, item.state === 'current' && styles.lessonPathRowCurrent, { opacity: item.state === 'locked' ? 0.65 : pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.lessonPathStatus, item.state === 'completed' && styles.lessonPathStatusDone, item.state === 'current' && styles.lessonPathStatusCurrent]}>
        <Text style={styles.lessonPathStatusIcon}>{statusIcon}</Text>
      </View>
      <View style={styles.lessonPathText}>
        <View style={styles.lessonPathTitleRow}>
          <Text style={styles.lessonPathLessonTitle} numberOfLines={2}>{item.lesson.title}</Text>
          <Text style={[styles.lessonPathState, item.state === 'completed' && styles.lessonPathStateDone]}>{stateLabel}</Text>
        </View>
        <Text style={styles.lessonPathHelper} numberOfLines={2}>{item.helperText}</Text>
        <Text style={styles.lessonPathAction} numberOfLines={2}>{item.primaryActionLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lessonPathRow: { flexDirection: 'row', gap: ds.spacing.sm, alignItems: 'flex-start', padding: ds.spacing.sm, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt },
  lessonPathRowCurrent: { backgroundColor: ds.colors.brandSoft },
  lessonPathStatus: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.colors.border },
  lessonPathStatusDone: { backgroundColor: ds.colors.successSoft },
  lessonPathStatusCurrent: { backgroundColor: ds.colors.brand },
  lessonPathStatusIcon: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.text },
  lessonPathText: { flex: 1, minWidth: 0 },
  lessonPathTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ds.spacing.sm },
  lessonPathLessonTitle: { flex: 1, minWidth: 0, fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, lineHeight: 20 },
  lessonPathState: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.textMuted, textTransform: 'uppercase' },
  lessonPathStateDone: { color: ds.colors.success },
  lessonPathHelper: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  lessonPathAction: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '900', marginTop: ds.spacing.xs },
});