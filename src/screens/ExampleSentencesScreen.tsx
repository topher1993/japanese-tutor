import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getExampleSentencesForApp, type ExampleSentenceCandidateEntry } from '../data/candidates/exampleSentenceCandidatePack';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ds } from '../theme/designSystem';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { useLearningContext } from '../services/learningContext';
import type { LearnerProgress } from '../types/progress';
import { getAllLessons } from '../services/lessonService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { pickReportableSentenceIds } from './exampleSentencesViewTracking';
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
function deriveExampleWeekNumber(progress: LearnerProgress | null | undefined): number {
  const safeProgress: LearnerProgress = progress ?? {
    startedAt: new Date().toISOString(),
    completedLessonIds: [],
    quizScores: [],
    streak: { currentStreak: 0, longestStreak: 0 },
  };
  const path = buildLessonInteractionPath(getAllLessons(), safeProgress);
  return path.currentLesson?.week ?? 1;
}

export function ExampleSentencesScreen({ supportLanguage = 'en' }: { supportLanguage?: LearnerLanguage } = {}) {
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

  // Phase 37d-5 — view-tracking effect. Consumes the same practiceProgressStore
  // that LessonsScreen and the rest of the app use, via the
  // LearningRepositoryProvider context. Earlier drafts considered opening a
  // fresh SQLite handle here per sentence view, which would race with the
  // provider's open and double-initialize the schema — replaced with the
  // context's store accessor (matches the DailyRushScreen / FlashcardsScreen
  // / QuizScreen pattern from 37d-1..37d-4).
  const { store: practiceStore } = useLearningContext();
  // Per-sentence debounce timestamp map. We skip the store call if the same
  // sentenceId was reported within EXAMPLE_VIEW_DEBOUNCE_MS — that is what
  // test (e) covers (5 calls in 100ms with the same id collapse to one).
  const lastReportedAt = useRef<Map<string, number>>(new Map());
  // Memoize the weekNumber so the effect doesn't re-run on every render when
  // the active filter / level changes. We compute it once at mount + when
  // `practiceStore` changes. This is a derived reading from progress, not a
  // write, so a stale value across short re-renders is fine.
  const weekNumberRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isTodoFeatureEnabled() || !practiceStore) return;
    if (weekNumberRef.current != null) return;
    let cancelled = false;
    void (async () => {
      try {
        const progress = await practiceStore.getProgress();
        if (cancelled) return;
        weekNumberRef.current = deriveExampleWeekNumber(progress);
      } catch {
        // progress read failed — leave weekNumberRef as null and skip tracking
        // for this session; the gate is invisible either way (default false).
      }
    })();
    return () => { cancelled = true; };
  }, [practiceStore]);

  useEffect(() => {
    if (!isTodoFeatureEnabled() || !practiceStore) return;
    if (weekNumberRef.current == null) return; // not yet resolved
    const weekNumber = weekNumberRef.current;
    const reportedIds = pickReportableSentenceIds(filtered, lastReportedAt.current, Date.now());
    if (reportedIds.length === 0) return;
    void (async () => {
      for (const sentenceId of reportedIds) {
        try {
          await practiceStore.markExampleViewed(weekNumber, sentenceId);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[example-sentences] failed to record view', err);
        }
      }
    })();
  }, [filtered, practiceStore]);

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

      {filtered.map((s: ExampleSentenceCandidateEntry) => {
        const translations = getVisibleOptionalTranslations(s, supportLanguage);
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
});
