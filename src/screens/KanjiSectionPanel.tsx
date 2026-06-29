import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildKanjiSection, mergeKanjiCardPool, type KanjiLevel } from '../services/kanjiSectionService';
import { buildCandidateKanjiSection, getCandidateKanjiCounts } from '../services/candidateKanjiAdapter';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FlipCard } from '../components/FlipCard';
import { JishoLink } from '../components/JishoLink';
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
  const [incomingDirection, setIncomingDirection] = useState<'left' | 'right' | null>(null);

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

  function showNextCard() {
    setIncomingDirection('left');
    setCardIndex(index => Math.min(cardsInLevel.length - 1, index + 1));
  }

  function showPreviousCard() {
    setIncomingDirection('right');
    setCardIndex(index => Math.max(0, index - 1));
  }

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

      <View style={styles.flipWrap}>
        <FlipCard
          key={card.id}
          front={
            <View style={styles.cardFace}>
              <Badge label={card.jlptLevel} tone="info" />
              <Text style={styles.kanji}>{card.kanji}</Text>
              <Text style={styles.sectionLabel}>On / Kun readings</Text>
              <Text style={styles.readings}>{card.readings.join(' / ')}</Text>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Meanings</Text>
              <Text style={styles.meanings}>{card.meanings.join(', ')}</Text>
              <Text style={styles.cardHint}>Tap for example words • swipe to change card</Text>
            </View>
          }
          back={
            <View style={styles.cardFace}>
              <Text style={styles.sectionLabel}>Example words</Text>
              {card.exampleWords.slice(0, 3).map(example => (
                <View key={`${card.id}-${example.japanese}`} style={styles.exampleRow}>
                  <Text style={styles.exampleJapanese}>• {example.japanese}</Text>
                  <Text style={styles.exampleReading}>{example.reading} • {example.romaji}</Text>
                  <Text style={styles.exampleEnglish}>{example.english}</Text>
                </View>
              ))}
            </View>
          }
          cardNumber={safeCardIndex + 1}
          totalCards={cardsInLevel.length}
          cornerBadge={<JishoLink japanese={card.kanji} variant="corner" testID={`kanji-jisho-${card.id}`} />}
          onSwipeLeft={showNextCard}
          onSwipeRight={showPreviousCard}
          swipeInDirection={incomingDirection}
        />
      </View>
      <View style={styles.actions}>
        <Button label="Prev" onPress={showPreviousCard} variant="soft" icon="arrow-left" fullWidth={false} style={styles.actionBtn} />
        <Button label="Next" onPress={showNextCard} variant="primary" iconRight="arrow-right" fullWidth={false} style={styles.actionBtn} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: ds.spacing.xs, marginBottom: ds.spacing.sm },
  flipWrap: { marginTop: ds.spacing.xs },
  cardFace: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  kanji: { fontSize: 96, lineHeight: 110, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.sm },
  readings: { color: ds.colors.primary, fontWeight: '900', fontSize: ds.type.heading, marginTop: ds.spacing.xs, flexShrink: 1, textAlign: 'center' },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm, alignSelf: 'stretch' },
  meanings: { color: ds.colors.text, fontWeight: '800', fontSize: ds.type.body, textAlign: 'center', flexShrink: 1 },
  sectionLabel: { marginBottom: ds.spacing.sm, fontWeight: '900', color: ds.colors.primary, fontSize: ds.type.caption, textTransform: 'uppercase', alignSelf: 'flex-start' },
  cardHint: { marginTop: ds.spacing.md, fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.textMuted, textAlign: 'center' },
  exampleRow: { alignSelf: 'stretch', paddingVertical: ds.spacing.xs, borderBottomWidth: 1, borderBottomColor: ds.colors.divider },
  exampleJapanese: { fontSize: ds.type.heading, color: ds.colors.text, fontWeight: '900', flexShrink: 1 },
  exampleReading: { marginTop: ds.spacing.xs, fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '800', flexShrink: 1 },
  exampleEnglish: { marginTop: ds.spacing.xs, fontSize: ds.type.caption, color: ds.colors.textMuted, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: ds.spacing.sm, marginTop: ds.spacing.md, alignSelf: 'stretch' },
  actionBtn: { flex: 1 },
  counter: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.textMuted },
  empty: { fontSize: ds.type.body, color: ds.colors.textMuted },
});
