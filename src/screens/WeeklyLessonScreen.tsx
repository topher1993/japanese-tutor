import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { getWeeklyLessonSummary } from '../services/lessonService';
import { ds } from '../theme/designSystem';

export function WeeklyLessonScreen() {
  const week = getWeeklyLessonSummary(1);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Week {week.week} Objectives</Text>
      {week.objectives.map(objective => (
        <Text key={objective} style={styles.bullet}>• {objective}</Text>
      ))}
      {week.lessons.map(lesson => (
        <View key={lesson.id} style={styles.card}>
          <Text style={styles.lesson}>{lesson.title}</Text>
          <Text>{lesson.summary}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ds.colors.background },
  content: { padding: ds.spacing.lg },
  title: { fontSize: ds.type.title, fontWeight: '900' },
  bullet: { marginTop: ds.spacing.sm },
  card: { backgroundColor: ds.colors.surface, padding: ds.spacing.md, borderRadius: ds.radius.md, marginTop: ds.spacing.md },
  lesson: { fontWeight: '800', color: ds.colors.text },
});