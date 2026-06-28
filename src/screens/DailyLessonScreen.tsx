import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { getDailyLesson } from '../services/lessonService';
import { ds } from '../theme/designSystem';

export function DailyLessonScreen() {
  const lesson = getDailyLesson();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{lesson.title}</Text>
      {lesson.items.map(item => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.jp}>{item.japanese}</Text>
          <Text>{item.romaji}</Text>
          <Text>{item.english}</Text>
          <Text>{item.vietnamese}</Text>
          <Text>{item.filipino}</Text>
          <Text style={styles.example}>{item.exampleJapanese} — {item.exampleEnglish}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ds.colors.background },
  content: { padding: ds.spacing.lg },
  title: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.md },
  item: { backgroundColor: ds.colors.surface, padding: ds.spacing.md, borderRadius: ds.radius.md, marginBottom: ds.spacing.md },
  jp: { fontSize: ds.type.display, fontWeight: '800' },
  example: { color: ds.colors.textMuted, marginTop: ds.spacing.sm },
});