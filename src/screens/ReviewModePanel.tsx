import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildReviewSession, type ReviewLevel, type ReviewSessionResult } from '../services/reviewModeService';
import { getCandidateReviewCounts } from '../services/candidateReviewAdapter';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { ds } from '../theme/designSystem';
import { learningGroupLabel, partOfSpeechLabel, VOCABULARY_LEARNING_GROUPS, type VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';

export function ReviewModePanel({ onBack }: { onBack?: () => void }) {
  const [level, setLevel] = useState<ReviewLevel | 'mixed'>('mixed');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<number[]>([]);
  const [result, setResult] = useState<ReviewSessionResult | null>(null);
  const [group, setGroup] = useState<VocabularyLearningGroup | 'all'>('all');

  const session = useMemo(() => buildReviewSession(
    level === 'mixed' ? undefined : level,
    group === 'all' ? undefined : group,
  ), [group, level]);
  const current = session.items[currentIdx];
  const candidateCounts = getCandidateReviewCounts();

  function answer(idx: number) {
    const next = [...responses, idx];
    setResponses(next);
    if (currentIdx + 1 >= session.items.length) {
      const r = session.score(next);
      setResult(r);
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  }

  function restart() {
    setCurrentIdx(0);
    setResponses([]);
    setResult(null);
  }

  if (result) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Review session complete" onBack={onBack} />
        <Card tone="brand" shadow="hero">
          <Text style={styles.bigNumber}>{result.percent}%</Text>
          <Text style={styles.subtitle}>{result.correctCount} of {session.items.length} correct</Text>
          <Button label="Start new review" onPress={restart} icon="play" />
        </Card>
      </ScreenScaffold>
    );
  }

  if (!current) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Review mode" onBack={onBack} />
        <Card tone="soft"><Text style={styles.empty}>No review items available.</Text></Card>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <ScreenHeader
        title="Review mode"
        subtitle={`Question ${currentIdx + 1} of ${session.items.length}`}
        onBack={onBack}
      />

      <Card tone="info" shadow="card">
        <Text style={styles.candidateBadge}>
          Approved-for-beta pool: {candidateCounts.total} vocab candidates ready for review wiring ({candidateCounts.n5} N5 + {candidateCounts.n4} N4)
        </Text>
      </Card>

      <View style={styles.levelRow}>
        {(['mixed', 'N5', 'N4'] as Array<ReviewLevel | 'mixed'>).map(l => (
          <Chip
            key={l}
            label={l.toUpperCase()}
            selected={level === l}
            onPress={() => { setLevel(l); restart(); }}
          />
        ))}
      </View>

      <Text style={styles.filterLabel}>Word type</Text>
      <View style={styles.levelRow}>
        <Chip label="All" selected={group === 'all'} onPress={() => { setGroup('all'); restart(); }} />
        {VOCABULARY_LEARNING_GROUPS.map(value => (
          <Chip
            key={value}
            label={learningGroupLabel(value)}
            selected={group === value}
            onPress={() => { setGroup(value); restart(); }}
          />
        ))}
      </View>

      <Card shadow="hero">
        <Text style={styles.prompt}>{current.prompt}</Text>
        <Text style={styles.tag}>{partOfSpeechLabel(current.partOfSpeech)} • {current.jlptLevel}</Text>
        <View style={styles.options}>
          {current.choices.map((choice, idx) => (
            <Pressable
              key={idx}
              accessibilityRole="button"
              accessibilityLabel={choice}
              style={({ pressed }) => [styles.choice, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => answer(idx)}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  bigNumber: { fontSize: ds.type.display + 16, lineHeight: 60, fontWeight: '900', color: ds.colors.brandInk, textAlign: 'center' },
  subtitle: { fontSize: ds.type.body, color: ds.colors.brandInk, opacity: 0.85, textAlign: 'center', marginBottom: ds.spacing.md },
  empty: { fontSize: ds.type.body, color: ds.colors.textMuted },
  candidateBadge: { fontSize: ds.type.caption, color: ds.colors.text, fontWeight: '800', lineHeight: 20, flexShrink: 1 },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginBottom: ds.spacing.sm },
  filterLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  prompt: { fontSize: ds.type.heading + 2, lineHeight: 28, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  tag: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.textMuted, marginTop: ds.spacing.xs, textTransform: 'uppercase' },
  options: { marginTop: ds.spacing.md, gap: ds.spacing.sm },
  choice: {
    backgroundColor: ds.colors.surfaceAlt,
    paddingVertical: ds.spacing.sm,
    paddingHorizontal: ds.spacing.md,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.colors.border,
    minHeight: ds.touch.min,
    justifyContent: 'center',
  },
  choiceText: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '800', flexShrink: 1 },
});
