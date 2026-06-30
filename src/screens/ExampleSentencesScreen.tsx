import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getExampleSentencesForApp, type ExampleSentenceCandidateEntry } from '../data/candidates/exampleSentenceCandidatePack';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ds } from '../theme/designSystem';

const CATEGORY_LABELS: Record<string, string> = {
  greetings: 'Greetings',
  'self-introduction': 'Self-introduction',
  workplace: 'Workplace',
  safety: 'Safety',
  hr: 'HR',
  shopping: 'Shopping',
  travel: 'Travel',
  directions: 'Directions',
  restaurant: 'Restaurant',
  'daily-life': 'Daily life',
  feelings: 'Feelings',
  grammar: 'Grammar',
  questions: 'Questions',
  experience: 'Experience',
  plans: 'Plans',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

export function ExampleSentencesScreen() {
  const all = useMemo(() => getExampleSentencesForApp(), []);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of all) set.add(s.category);
    return Array.from(set).sort();
  }, [all]);
  const [active, setActive] = useState<string>(categories[0] ?? 'greetings');
  const [level, setLevel] = useState<'all' | 'N5' | 'N4'>('all');

  const filtered = useMemo(() => {
    return all.filter((s) => {
      if (s.category !== active) return false;
      if (level === 'all') return true;
      return s.jlptLevel === level;
    });
  }, [all, active, level]);

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <Text style={styles.title}>Example sentences</Text>
        <Text style={styles.subtitle}>
          {all.length} curated and lesson-linked sentences. Browse by topic — lesson examples stay here, not in flashcards or Daily Rush.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Level</Text>
      <View style={styles.chipRow}>
        {(['all', 'N5', 'N4'] as const).map(l => (
          <Chip key={l} label={l === 'all' ? 'All' : l} selected={level === l} onPress={() => setLevel(l)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Topic</Text>
      <View style={styles.chipRow}>
        {categories.map(cat => (
          <Chip key={cat} label={categoryLabel(cat)} selected={active === cat} onPress={() => setActive(cat)} />
        ))}
      </View>

      <Text style={styles.count}>{filtered.length} sentences</Text>

      {filtered.map((s: ExampleSentenceCandidateEntry) => (
        <Card key={s.id} shadow="card">
          <View style={styles.cardHeader}>
            <Badge label={s.jlptLevel} tone="brand" />
            <Badge label={s.connectedToApp ? 'Lesson' : 'Reference'} tone="neutral" />
          </View>
          <Text style={styles.jp}>{s.japanese}</Text>
          {s.romaji ? <Text style={styles.romaji}>{s.romaji}</Text> : null}
          <View style={styles.divider} />
          <Text style={styles.english}>{s.english}</Text>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: ds.spacing.sm },
  title: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text },
  subtitle: { fontSize: ds.type.body, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 22 },
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginTop: ds.spacing.md, marginBottom: ds.spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  count: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.textMuted, marginTop: ds.spacing.md, marginBottom: ds.spacing.xs },
  cardHeader: { flexDirection: 'row', gap: ds.spacing.xs, marginBottom: ds.spacing.sm },
  jp: { fontSize: ds.type.heading + 4, fontWeight: '900', color: ds.colors.text, lineHeight: 30, flexShrink: 1 },
  romaji: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800', marginTop: ds.spacing.xs, flexShrink: 1 },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm },
  english: { fontSize: ds.type.body, color: ds.colors.textMuted, flexShrink: 1 },
});
