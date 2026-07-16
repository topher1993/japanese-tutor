import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getExampleSentencesForApp, type ExampleSentenceCandidateEntry } from '../data/candidates/exampleSentenceCandidatePack';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ds } from '../theme/designSystem';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { useLearningContext } from '../services/learningContext';
import { resolveActivePhraseWeek } from '../services/activeLessonWeekService';
import { useUserProfileContext } from '../services/userProfileContext';
import { getVisibleOptionalTranslations } from '../services/supportLanguageService';
import type { LearnerLanguage } from '../types/onboarding';

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

/**
 * Phase 37d-5 — derive the active week for example-sentence view-tracking.
 * Mirrors DailyRushScreen.deriveDailyRushWeekNumber. The example-sentences
 * screen is week-agnostic today (it shows all sentences), but the §5
 * counter is per-week, so we map to the learner's current week via the
 * lesson interaction path. Falls back to week 1 when the learner has
 * not started.
 */
export function ExampleSentencesScreen({ supportLanguage = 'en' }: { supportLanguage?: LearnerLanguage } = {}) {
  const all = useMemo(() => getExampleSentencesForApp(), []);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of all) set.add(s.category);
    return Array.from(set).sort();
  }, [all]);
  const [active, setActive] = useState<string>(categories[0] ?? 'greetings');
  const [level, setLevel] = useState<'all' | ExampleSentenceCandidateEntry['jlptLevel']>('all');

  const filtered = useMemo(() => {
    return all.filter((s) => {
      if (s.category !== active) return false;
      if (level === 'all') return true;
      return s.jlptLevel === level;
    });
  }, [all, active, level]);

  // Sentence progress is recorded only after the learner explicitly marks a
  // card studied. Rendering or changing filters must never create progress.
  const { store: practiceStore } = useLearningContext();
  const { profile } = useUserProfileContext();
  const placementLevel = profile?.dynamic.placement?.level;
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set());
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  useEffect(() => {
    if (!isTodoFeatureEnabled() || !practiceStore) return;
    let cancelled = false;
    void (async () => {
      try {
        const progress = await practiceStore.getProgress();
        if (cancelled) return;
        const resolvedWeek = resolveActivePhraseWeek(progress, placementLevel);
        const extended = await practiceStore.getExtendedProgress();
        if (cancelled) return;
        setWeekNumber(resolvedWeek);
        setStudiedIds(new Set(extended.todoEventCounts.exampleSentencesViewed?.[resolvedWeek] ?? []));
      } catch {
        if (!cancelled) setTrackingError('Study progress is unavailable right now.');
      }
    })();
    return () => { cancelled = true; };
  }, [practiceStore, placementLevel]);

  const markSentenceStudied = async (sentenceId: string) => {
    if (!isTodoFeatureEnabled() || !practiceStore || weekNumber == null || studiedIds.has(sentenceId)) return;
    setMarkingId(sentenceId);
    setTrackingError(null);
    try {
      await practiceStore.markExampleViewed(weekNumber, sentenceId);
      setStudiedIds(previous => new Set(previous).add(sentenceId));
    } catch (err) {
      if (__DEV__) console.warn('[example-sentences] failed to record study', err);
      setTrackingError('Could not save this sentence. Please try again.');
    } finally {
      setMarkingId(null);
    }
  };

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
        {(['all', 'N5', 'N4', 'N3'] as const).map(l => (
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
      {trackingError ? <Text style={styles.errorText}>{trackingError}</Text> : null}

      {filtered.map((s: ExampleSentenceCandidateEntry) => {
        const translations = getVisibleOptionalTranslations(s, supportLanguage);
        const isStudied = studiedIds.has(s.id);
        return (
          <Card key={s.id} shadow="card">
            <View style={styles.cardHeader}>
              <Badge label={s.jlptLevel} tone="brand" />
              <Badge label={s.connectedToApp ? 'Lesson' : 'Reference'} tone="neutral" />
            </View>
            <Text style={styles.jp}>{s.japanese}</Text>
            {s.romaji ? <Text style={styles.romaji}>{s.romaji}</Text> : null}
            <View style={styles.divider} />
            {translations.map((translation, i) => (
              <Text
                key={`${translation.label}-${i}`}
                style={translation.label === 'English' ? styles.english : styles.secondaryTranslation}
              >
                {translation.label}: {translation.text}
              </Text>
            ))}
            {isTodoFeatureEnabled() && practiceStore ? (
              <Button
                label={isStudied ? 'Studied' : markingId === s.id ? 'Saving…' : 'Mark studied'}
                onPress={() => { void markSentenceStudied(s.id); }}
                variant={isStudied ? 'soft' : 'secondary'}
                size="md"
                disabled={isStudied || markingId != null || weekNumber == null}
                style={styles.studyButton}
                testID={`example-studied-${s.id}`}
              />
            ) : null}
          </Card>
        );
      })}
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
  secondaryTranslation: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '600', marginTop: ds.spacing.xs, flexShrink: 1 },
  studyButton: { marginTop: ds.spacing.md },
  errorText: { color: ds.colors.danger, fontSize: ds.type.caption, marginBottom: ds.spacing.sm },
});
