import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildPlacementTest, placementLevelLabel, scorePlacementTest, type PlacementLevel, type PlacementResult } from '../services/placementTestService';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { ds } from '../theme/designSystem';

export function PlacementTestPanel({
  onBack,
  onComplete,
  onContinue,
}: {
  onBack?: () => void;
  onComplete?: (result: PlacementResult) => void;
  onContinue?: (level: PlacementLevel) => void;
}) {
  const test = useMemo(() => buildPlacementTest(), []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<number[]>([]);
  const [result, setResult] = useState<ReturnType<typeof scorePlacementTest> | null>(null);

  const current = test.questions[currentIdx];

  function answer(choiceIndex: number) {
    const next = [...responses, choiceIndex];
    setResponses(next);
    if (currentIdx + 1 >= test.questions.length) {
      const r = scorePlacementTest(next);
      setResult(r);
      if (onComplete) onComplete(r);
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
        <ScreenHeader title="Placement result" onBack={onBack} />
        <Card tone="brand" shadow="hero">
          <Text style={styles.bigNumber}>{result.scorePercent}%</Text>
          <Text style={styles.subtitle}>Recommended level: {placementLevelLabel(result.recommendedLevel)}</Text>
          <Text style={styles.disclaimer}>This is a study recommendation, not an official JLPT score.</Text>
          <Text style={styles.sectionLabel}>By level</Text>
          {result.byLevel.map(b => (
            <View key={b.level} style={styles.row}>
              <Text style={styles.rowLabel}>{b.level}</Text>
              <Text style={styles.rowValue}>{b.correct}/{b.total}</Text>
            </View>
          ))}
          <Button label="Retake placement" onPress={restart} icon="play" />
          {onContinue ? (
            <Button
              label={`Start ${placementLevelLabel(result.recommendedLevel)} lessons`}
              onPress={() => onContinue(result.recommendedLevel)}
              iconRight="arrow-right"
              variant="primary"
            />
          ) : null}
        </Card>
      </ScreenScaffold>
    );
  }

  if (!current) {
    return null;
  }

  return (
    <ScreenScaffold>
      <ScreenHeader
        title="Placement test"
        onBack={onBack}
        subtitle={`Question ${currentIdx + 1} of ${test.totalQuestions} • Level: ${current.level}`}
      />
      <Card shadow="hero">
        <Text style={styles.prompt}>{current.prompt}</Text>
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
  disclaimer: { fontSize: ds.type.caption, color: ds.colors.brandInk, opacity: 0.75, textAlign: 'center', marginBottom: ds.spacing.sm },
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandInk, opacity: 0.85, textTransform: 'uppercase', marginTop: ds.spacing.sm, marginBottom: ds.spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: ds.spacing.xs },
  rowLabel: { fontSize: ds.type.body, color: ds.colors.brandInk, fontWeight: '800' },
  rowValue: { fontSize: ds.type.body, color: ds.colors.brandInk, fontWeight: '900' },
  prompt: { fontSize: ds.type.heading + 2, lineHeight: 28, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.md, flexShrink: 1 },
  options: { gap: ds.spacing.sm },
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
