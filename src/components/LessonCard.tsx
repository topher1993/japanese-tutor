import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { SenseiLesson } from '../types/lesson';
import { ds } from '../theme/designSystem';

export function LessonCard({ lesson }: { lesson: SenseiLesson }) {
  return (
    <View style={styles.card}>
      <Text style={styles.level}>{lesson.level} • Week {lesson.week}</Text>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.summary}>{lesson.summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: ds.colors.surface, padding: ds.spacing.md, borderRadius: ds.radius.md, marginBottom: ds.spacing.md, minWidth: 0 },
  level: { color: ds.colors.primary, fontWeight: '700', flexShrink: 1 },
  title: { fontSize: ds.type.heading, lineHeight: 25, fontWeight: '800', color: ds.colors.text, marginTop: ds.spacing.xs, flexShrink: 1 },
  summary: { color: ds.colors.textMuted, marginTop: ds.spacing.sm, lineHeight: 21, flexShrink: 1 },
});