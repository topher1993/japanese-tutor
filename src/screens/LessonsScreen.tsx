import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAllLessons, getDailyLesson } from '../services/lessonService';
import { createLessonNavigator } from '../services/lessonNavigatorService';
import { buildLessonProgression } from '../services/lessonProgressionService';
import { KanjiSectionPanel } from './KanjiSectionPanel';
import { getAdditionalLessonCategoryContent, getLocalizedAdditionalLessonPhrase } from '../services/additionalLessonContentService';
import { getSupportLanguageDisplayName } from '../services/supportLanguageService';
import { getLessonCategoryCards, type LessonCategoryCardId } from '../services/lessonCategoryService';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import { WorkplaceSurvivalScreen } from './WorkplaceSurvivalScreen';
import { ExampleSentencesScreen } from './ExampleSentencesScreen';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { notifyLessonCompleted } from '../components/CompletionToast';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { Icon, type IconName } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { TranslationStatusBadge } from '../components/TranslationStatusBadge';
import { JishoLink } from '../components/JishoLink';
import { useLearningContext } from '../services/learningContext';
import { ds } from '../theme/designSystem';

export function LessonsScreen({ supportLanguage = 'en', pendingLessonId }: { supportLanguage?: LearnerLanguage; pendingLessonId?: string }) {
  const lessons = getAllLessons();
    const { ready, store } = useLearningContext();
    const categories = getLessonCategoryCards();
    const [progress, setProgress] = useState<LearnerProgress | null>(null);
    const dailyLesson = getDailyLesson(progress ?? undefined);
    const [selectedCategory, setSelectedCategory] = useState<LessonCategoryCardId | undefined>(undefined);
    const [selected, setSelected] = useState<string | undefined>(undefined);
    const [showExamples, setShowExamples] = useState(false);
    const nav = createLessonNavigator(lessons, selected);
    const [progression] = useState(() => buildLessonProgression(dailyLesson.lesson.week));
    const [showKanji, setShowKanji] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const currentWeek = progression.currentWeekDetails();
    const weekProgress = {
      index: progression.currentWeek,
      total: progression.weeks.length,
      minutes: currentWeek.recommendedMinutes,
    };

    // Phase 30: re-read the raw learner progress on mount so the daily
    // lesson label and weekly progress copy reflect the learner's actual
    // completion state instead of always defaulting to Week 1 Day 1.
    useEffect(() => {
      if (!ready || !store) return;
      let cancelled = false;
      store.getProgress()
        .then((p) => { if (!cancelled) setProgress(p); })
        .catch(() => undefined);
      return () => { cancelled = true; };
    }, [ready, store]);

  useEffect(() => {
    if (pendingLessonId) {
      setSelected(pendingLessonId);
      setSelectedCategory(undefined);
      setShowKanji(false);
      setShowMore(false);
    }
  }, [pendingLessonId]);

  if (showExamples) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setShowExamples(false)} titleStyle={styles.backHeader} />
        <ExampleSentencesScreen />
      </ScreenScaffold>
    );
  }

  if (showKanji) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setShowKanji(false)} titleStyle={styles.backHeader} />
        <KanjiSectionPanel onBack={() => setShowKanji(false)} />
      </ScreenScaffold>
    );
  }

  if (selectedCategory === 'workplace') {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setSelectedCategory(undefined)} titleStyle={styles.backHeader} />
        <WorkplaceSurvivalScreen supportLanguage={supportLanguage} />
      </ScreenScaffold>
    );
  }

  if (selectedCategory) {
    const categoryContent = getAdditionalLessonCategoryContent(selectedCategory);
    return (
      <ScreenScaffold>
        <ScreenHeader title={categoryContent.title} subtitle={categoryContent.description} onBack={() => setSelectedCategory(undefined)} />
        <Card tone="warm">
          <Text style={styles.tipLabel}>Sensei tip</Text>
          <Text style={styles.tipBody}>{categoryContent.coachTip}</Text>
        </Card>
        <Text style={styles.sectionTitle}>{categoryContent.phrases.length} practice phrases</Text>
        {categoryContent.phrases.map(phrase => {
          const localized = getLocalizedAdditionalLessonPhrase(phrase, supportLanguage);
          return (
            <Card key={phrase.id} shadow="card">
              <View style={styles.itemHeaderRow}>
                <View style={styles.itemHeaderSpacer} />
                <TranslationStatusBadge status={phrase.translationReviewStatus} supportLanguage={supportLanguage} compact />
              </View>
              <Text style={styles.jp}>{phrase.japanese}</Text>
              <View style={styles.jpMetaRow}>
                <Text style={styles.romaji}>{phrase.romaji}</Text>
                <JishoLink japanese={phrase.japanese} />
              </View>
              <View style={styles.divider} />
              <Text style={styles.translation}>{localized.primaryTranslation.label}: {localized.primaryTranslation.text}</Text>
              {localized.secondaryTranslations.map(translation => (
                <Text key={translation.label} style={styles.secondaryTranslation}>{translation.label}: {translation.text}</Text>
              ))}
              <Text style={styles.usage}>Use: {phrase.usageNote}</Text>
            </Card>
          );
        })}
      </ScreenScaffold>
    );
  }

  if (nav.selectedLesson) {
    const lesson = nav.selectedLesson;
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setSelected(undefined)} titleStyle={styles.backHeader} />
        <Card tone="brand" shadow="hero">
          <Text style={styles.lessonBadge}>{lesson.level} • Week {lesson.week}</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.lessonObjective}>{lesson.objective}</Text>
        </Card>
        <Text style={styles.sectionTitle}>{lesson.items.length} phrases</Text>
        {lesson.items.map((item, idx) => (
          <Card key={item.id} shadow="card">
            <View style={styles.itemHeaderRow}>
              <Text style={styles.itemIndex}>Phrase {idx + 1}</Text>
              <TranslationStatusBadge status={item.translationReviewStatus} supportLanguage={supportLanguage} />
            </View>
            <Text style={styles.jp}>{item.japanese}</Text>
            <View style={styles.jpMetaRow}>
              <Text style={styles.romaji}>{item.romaji}</Text>
              <JishoLink japanese={item.japanese} />
            </View>
            <View style={styles.divider} />
            <Text style={styles.translation}>EN: {item.english}</Text>
            {item.vietnamese ? <Text style={styles.secondaryTranslation}>VI: {item.vietnamese}</Text> : null}
            {item.filipino ? <Text style={styles.secondaryTranslation}>TL: {item.filipino}</Text> : null}
          </Card>
        ))}
        {nav.nextLesson() ? (
          <Button
            label={`Next: ${nav.nextLesson()!.title}`}
            onPress={() => setSelected(nav.nextLesson()!.id)}
            variant="secondary"
            iconRight="arrow-right"
          />
        ) : null}
        <Button
          label="Mark this lesson complete"
          variant="primary"
          iconRight="check"
          onPress={async () => {
            if (ready && store) {
              try { await store.completeCurrentLesson(lesson.id, 100, new Date().toISOString().slice(0, 10)); } catch { /* best-effort */ }
            }
            const next = nav.nextLesson();
            if (next) setSelected(next.id);
          }}
          testID="lesson-mark-complete-button"
        />
      </ScreenScaffold>
    );
  }

  if (lessons.length === 0) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Lessons" />
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="lessons" size={220} />
          <Text style={styles.emptyTitle}>No lessons yet</Text>
          <Text style={styles.emptyBody}>Lessons will appear here once your placement test is complete.</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
      <ScreenScaffold>
        <ScreenHeader
          title="Lessons"
          subtitle={`Week ${weekProgress.index} of ${weekProgress.total} • ${dailyLesson.lessonsDoneThisWeek} of ${dailyLesson.lessonsTotalThisWeek} lessons done • ${weekProgress.minutes} min`}
        />

        <Card tone="brand" shadow="hero" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Mascot expression="encourage" size={56} />
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  {dailyLesson.isWeekPreview ? 'New week unlocked!' : `Week ${weekProgress.index}`}
                </Text>
              </View>
              <Text style={styles.heroTitle}>{currentWeek.label.replace(/^Week \d+ — /, '')}</Text>
            </View>
          </View>
          <Text style={styles.heroMeta}>Theme: {currentWeek.theme}</Text>
          {dailyLesson.isWeekPreview ? (
            <Text style={styles.heroMeta}>
              You finished Week {weekProgress.index - 1}. Tap below to start Week {weekProgress.index}.
            </Text>
          ) : null}
          {currentWeek.objectives.map((objective, idx) => (
            <View key={idx} style={styles.objectiveRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.objectiveText}>{objective}</Text>
            </View>
          ))}
          <Text style={styles.heroMeta}>
            {dailyLesson.lessonsDoneThisWeek} of {dailyLesson.lessonsTotalThisWeek} lessons done this week
          </Text>
        </Card>

        <View style={styles.ctaWrapper}>
          <Button
            label={
              dailyLesson.isWeekPreview
                ? `Start Week ${weekProgress.index}`
                : `Continue ${dailyLesson.lesson.title}`
            }
            onPress={async () => {
                        if (ready && store) {
                          try {
                            await store.completeCurrentLesson(dailyLesson.lesson.id, 100, new Date().toISOString().slice(0, 10));
                            // Re-read progress so the next render reflects the new
                            // completion and (if applicable) advances to the next week.
                            const refreshed = await store.getProgress();
                            setProgress(refreshed);
                            // Surface an in-app notification per the user's request.
                            const done = refreshed.completedLessonIds.length;
                            const total = lessons.length;
                            const weeklyDone = dailyLesson.lessonsDoneThisWeek + 1;
                            const weeklyTotal = dailyLesson.lessonsTotalThisWeek;
                            const detail =
                              weeklyDone >= weeklyTotal
                                ? `Week ${dailyLesson.lesson.week} complete! ${done} of ${total} lessons done total.`
                                : `${weeklyDone} of ${weeklyTotal} lessons done this week.`;
                            notifyLessonCompleted({ message: `✓ ${dailyLesson.lesson.title}`, detail });
                          } catch {
                            /* best-effort */
                          }
                        }
                        setSelected(dailyLesson.lesson.id);
                      }}
            iconRight="arrow-right"
            variant="secondary"
            testID="learn-continue-button"
          />
        </View>

      <Text style={styles.sectionTitle}>Topics</Text>
      <View style={styles.chipRow}>
        {categories.map(category => (
          <Chip
            key={category.id}
            label={`${category.title} (${category.phraseCount})`}
            selected={selectedCategory === category.id}
            onPress={() => category.status === 'available' ? setSelectedCategory(category.id) : undefined}
          />
        ))}
      </View>

      <Disclosure title="More tools" icon="more" open={showMore} onToggle={() => setShowMore(v => !v)}>
        <ToolRow
          icon="kanji"
          label="Kanji section"
          hint="Learn the characters"
          onPress={() => setShowKanji(true)}
        />
        <ToolRow
          icon="chat"
          label="Example sentences"
          hint="200+ curated sentences by topic"
          onPress={() => setShowExamples(true)}
        />
        <ToolRow
                  icon="clock"
                  label="Today's plan"
                  hint={
                    dailyLesson.isCourseComplete
                      ? 'Course complete — keep reviewing'
                      : dailyLesson.isWeekPreview
                        ? `Start Week ${weekProgress.index} (Day 1)`
                        : `${dailyLesson.lesson.title} • ${dailyLesson.lessonsDoneThisWeek}/${dailyLesson.lessonsTotalThisWeek} this week`
                  }
                  onPress={() => setSelected(dailyLesson.lesson.id)}
                />
      </Disclosure>
    </ScreenScaffold>
  );
}

function ToolRow({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toolRow, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.toolIcon}>
        <Icon name={icon} size={20} />
      </View>
      <View style={styles.toolText}>
        <Text style={styles.toolLabel}>{label}</Text>
        <Text style={styles.toolHint}>{label === 'Kanji section' ? hint : hint}</Text>
      </View>
      <Icon name="arrow-right" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: ds.spacing.lg, gap: ds.spacing.sm },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs, borderRadius: ds.radius.sm },
  heroBadgeText: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.brandInk, textTransform: 'uppercase' },
  heroTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.brandInk, flexShrink: 1, lineHeight: 28 },
  heroMeta: { fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.brandInk, opacity: 0.85 },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.xs, marginTop: ds.spacing.xs },
  bullet: { color: ds.colors.brandInk, opacity: 0.8 },
  objectiveText: { color: ds.colors.brandInk, fontSize: ds.type.body, flexShrink: 1, lineHeight: 22 },
  ctaWrapper: { marginTop: 0 },
  sectionTitle: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginBottom: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, rowGap: ds.spacing.sm },
  jp: { fontSize: ds.type.heading + 4, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  romaji: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800', marginTop: ds.spacing.xs, flexShrink: 1 },
  jpMetaRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, flexWrap: 'wrap', marginTop: ds.spacing.xs },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm },
  translation: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '800', flexShrink: 1 },
  secondaryTranslation: { fontSize: ds.type.body, color: ds.colors.textMuted, marginTop: ds.spacing.xs, flexShrink: 1 },
  usage: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, fontStyle: 'italic', flexShrink: 1 },
  tipLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.warmInk, textTransform: 'uppercase' },
  tipBody: { fontSize: ds.type.body, color: ds.colors.warmInkStrong, marginTop: ds.spacing.xs, lineHeight: 22, flexShrink: 1 },
  lessonBadge: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.brandInk, opacity: 0.85, textTransform: 'uppercase' },
  lessonTitle: { fontSize: ds.type.display - 2, fontWeight: '900', color: ds.colors.brandInk, marginTop: ds.spacing.xs, flexShrink: 1 },
  lessonObjective: { fontSize: ds.type.body, color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs, flexShrink: 1 },
  itemIndex: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ds.spacing.sm,
    marginBottom: ds.spacing.xs,
  },
  itemHeaderSpacer: { flex: 1 },
  toolRow: {
    flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm,
    backgroundColor: ds.colors.surface, padding: ds.spacing.sm,
    borderRadius: ds.radius.md, minHeight: ds.touch.min,
  },
  toolIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ds.colors.brandSoft, alignItems: 'center', justifyContent: 'center',
  },
  toolText: { flex: 1, minWidth: 0 },
  toolLabel: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  toolHint: { fontSize: ds.type.caption, color: ds.colors.textMuted, flexShrink: 1 },
  backHeader: { fontSize: ds.type.body },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1 },
});