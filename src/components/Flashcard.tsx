import { Text, View, StyleSheet } from 'react-native';
import type { LessonItem } from '../types/lesson';
import { ds } from '../theme/designSystem';

export function Flashcard({ item }: { item: LessonItem }) {
  const vocabulary = item.vocabulary;
  return (
    <View style={styles.card}>
      <Text style={styles.japanese}>{vocabulary?.japanese ?? item.japanese}</Text>
      <Text>{vocabulary?.romaji ?? item.romaji}</Text>
      <Text style={styles.meaning}>{vocabulary?.meanings.en.join('; ') ?? item.english}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: ds.colors.surface, padding: ds.spacing.lg, borderRadius: ds.radius.lg, alignItems: 'center' },
  japanese: { fontSize: ds.type.display, fontWeight: '800', color: ds.colors.text },
  meaning: { marginTop: ds.spacing.sm, color: ds.colors.primary, fontWeight: '700' },
});
