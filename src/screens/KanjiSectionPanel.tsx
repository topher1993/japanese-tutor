import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildKanjiSection, mergeKanjiCardPool, type KanjiLevel } from '../services/kanjiSectionService';
import { buildCandidateKanjiSection, getCandidateKanjiCounts } from '../services/candidateKanjiAdapter';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { ds } from '../theme/designSystem';

interface KanjiSection { cards: ReturnType<typeof buildKanjiSection>['cards']; lessons: ReturnType<typeof buildKanjiSection>['lessons']; }

export function KanjiSectionPanel({ onBack }: { onBack?: () => void }) {
  // Phase 22 audit fix P1-07: candidate packs load via dynamic import.
  const [section, setSection] = useState<KanjiSection | null>(null);
  const [candidateCounts, setCandidateCounts] = useState<{ n5: number; n4: number; total: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = buildKanjiSection();
        const candidate = await buildCandidateKanjiSection();
        if (cancelled) return;
        setSection({
          cards: mergeKanjiCardPool([...base.cards, ...candidate.cards]),
          lessons: [...base.lessons, ...candidate.lessons],
        });
      } catch {
        if (cancelled) return;
        const base = buildKanjiSection();
        setSection({ cards: base.cards, lessons: base.lessons });
      }
    })();
    getCandidateKanjiCounts().then(c => { if (!cancelled) setCandidateCounts(c); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const [level, setLevel] = useState<KanjiLevel>('N5');
  const [cardIndex, setCardIndex] = useState(0);

  if (!section) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Kanji" subtitle="Loading..." />
      </ScreenScaffold>
    );
  }

  // Phase 28 content-visibility fix: navigate the full visible card pool for
  // the selected JLPT level. The previous implementation selected small lesson
  // windows instead of walking every loaded card, which made hundreds of
  // candidate kanji unreachable in the UI.
  const cardsInLevel = section.cards.filter(c => c.jlptLevel === level);
  const safeCardIndex = Math.min(cardIndex, Math.max(0, cardsInLevel.length - 1));
  const card = cardsInLevel[safeCardIndex];

  if (!card) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Kanji" onBack={onBack} />
        <Card tone="soft"><Text style={styles.empty}>No kanji cards available for {level}.</Text></Card>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <ScreenHeader title="Kanji" subtitle={`${section.cards.length} cards • ${candidateCounts?.total ?? 0} candidate`} onBack={onBack} />

      <View style={styles.chipRow}>
        {(['N5', 'N4'] as KanjiLevel[]).map(l => (
          <Chip key={l} label={l} selected={level === l} onPress={() => { setLevel(l); setCardIndex(0); }} />
        ))}
      </View>

      <Card shadow="hero" style={styles.kanjiCard}>
        <View style={styles.kanjiHeader}>
          <Badge label={card.jlptLevel} tone="info" />
          <Text style={styles.counter}>{safeCardIndex + 1} / {cardsInLevel.length}</Text>
        </View>
        <Text style={styles.kanji}>{card.kanji}</Text>
        <Text style={styles.readings}>{card.readings.join(' / ')}</Text>
        <View style={styles.divider} />
        <Text style={styles.meanings}>{card.meanings.join(', ')}</Text>
        <Text style={styles.sectionLabel}>Example words</Text>
        {card.exampleWords.map(w => (
          <Text key={w} style={styles.example}>• {w}</Text>
        ))}
        <View style={styles.actions}>
          <Button label="Prev" onPress={() => setCardIndex(index => Math.max(0, index - 1))} variant="soft" icon="arrow-left" fullWidth={false} style={styles.actionBtn} />
          <Button label="Next" onPress={() => setCardIndex(index => Math.min(cardsInLevel.length - 1, index + 1))} variant="primary" iconRight="arrow-right" fullWidth={false} style={styles.actionBtn} />
        </View>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: ds.spacing.xs, marginBottom: ds.spacing.sm },
  kanjiCard: { padding: ds.spacing.lg, gap: ds.spacing.xs, alignItems: 'center' },
  kanjiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  kanji: { fontSize: 96, lineHeight: 110, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.sm },
  readings: { color: ds.colors.primary, fontWeight: '900', fontSize: ds.type.heading, marginTop: ds.spacing.xs, flexShrink: 1, textAlign: 'center' },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm, alignSelf: 'stretch' },
  meanings: { color: ds.colors.text, fontWeight: '800', fontSize: ds.type.body, textAlign: 'center', flexShrink: 1 },
  sectionLabel: { marginTop: ds.spacing.md, marginBottom: ds.spacing.xs, fontWeight: '900', color: ds.colors.primary, fontSize: ds.type.caption, textTransform: 'uppercase', alignSelf: 'flex-start' },
  example: { fontSize: ds.type.body, color: ds.colors.text, lineHeight: 22, flexShrink: 1, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: ds.spacing.sm, marginTop: ds.spacing.md, alignSelf: 'stretch' },
  actionBtn: { flex: 1 },
  counter: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.textMuted },
  empty: { fontSize: ds.type.body, color: ds.colors.textMuted },
});
