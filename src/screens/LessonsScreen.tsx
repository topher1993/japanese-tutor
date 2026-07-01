import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAllLessons, getDailyLesson } from '../services/lessonService';
import { createLessonNavigator } from '../services/lessonNavigatorService';
import { buildLessonProgression } from '../services/lessonProgressionService';
import { buildLessonInteractionPath, type LessonPathItem } from '../services/lessonInteractionPathService';
import { KanjiSectionPanel } from './KanjiSectionPanel';
import { getAdditionalLessonCategoryContent, getLocalizedAdditionalLessonPhrase } from '../services/additionalLessonContentService';
import { getSupportLanguageDisplayName, getVisibleTranslations } from '../services/supportLanguageService';
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
import { WeeklyTodoBoardView } from '../components/WeeklyTodoBoardView';
import { useLearningContext } from '../services/learningContext';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { getAllWeekPlans } from '../services/weeklyPlansService';
import {
  buildAllTodoBoards,
  isWeekUnlocked,
  type TodoPayload,
} from '../services/weeklyTodoService';
import { emptyTodoEventCounts } from '../types/weeklyTodo';
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
    const lessonPath = buildLessonInteractionPath(lessons, progress ?? { startedAt: '', completedLessonIds: [], quizScores: [], streak: { currentStreak: 0, longestStreak: 0 } });
    const progression = buildLessonProgression(lessonPath.currentWeek.week);
    const [showKanji, setShowKanji] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const currentWeek = progression.currentWeekDetails();
        const weekProgress = {
          index: lessonPath.currentWeek.week,
          total: progression.weeks.length,
          minutes: currentWeek.recommendedMinutes,
        };

        // Phase 37c: build the per-week todo boards and decide whether the
                // "next week" CTA is unlocked. The UI gate (`isTodoFeatureEnabled()`)
                // stays false by default in 37c, so the block below is invisible to
                // learners. 37g flips the flag for the rollout. Boards are recomputed
                // whenever persisted progress changes so completed counts stay fresh.
                const todoPayload = React.useMemo<TodoPayload>(() => {
                                  const extended = store?.getExtendedProgress() ?? {
                                    todoStates: {},
                                    weekTodosInitialized: {},
                                    todoEventCounts: emptyTodoEventCounts(),
                                  };
                                  return {
                                    todoStates: extended.todoStates,
                                    weekTodosInitialized: extended.weekTodosInitialized,
                                    todoEventCounts: extended.todoEventCounts,
                                    completedLessonIds: progress?.completedLessonIds ?? [],
                                  };
                                }, [progress?.completedLessonIds, store]);
                const todoBoards = React.useMemo(
                  () => buildAllTodoBoards(getAllWeekPlans(), todoPayload, 'all', weekProgress.index),
                  [todoPayload, weekProgress.index],
                );
                const todoBoard = todoBoards[weekProgress.index];
                const nextWeekNumber = weekProgress.index + 1;
                const nextWeekUnlocked = isWeekUnlocked(nextWeekNumber, todoBoards, todoPayload);

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
    const selectedLessonCompleted = (progress?.completedLessonIds ?? []).includes(lesson.id);
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setSelected(undefined)} titleStyle={styles.backHeader} />
        <Card tone="brand" shadow="hero">
          <Text style={styles.lessonBadge}>{lesson.level} • Week {lesson.week}</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.lessonObjective}>{lesson.objective}</Text>
        </Card>
        <Text style={styles.sectionTitle}>{lesson.items.length} phrases</Text>
        {lesson.items.map((item, idx) => {
          const translations = getVisibleTranslations(item, supportLanguage);
          return (
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
              {translations.map(translation => (
                <Text
                  key={translation.label}
                  style={translation.label === 'English' ? styles.translation : styles.secondaryTranslation}
                >
                  {translation.label}: {translation.text}
                </Text>
              ))}
            </Card>
          );
        })}
        {selectedLessonCompleted && nav.nextLesson() ? (
                  <Button
                    label={`Next: ${nav.nextLesson()!.title}`}
                    onPress={() => setSelected(nav.nextLesson()!.id)}
                    variant="secondary"
                    iconRight="arrow-right"
                  />
                ) : null}
                {!selectedLessonCompleted ? (
                  <Button
                    label="Mark this lesson complete"
                    variant="primary"
                    iconRight="check"
                    onPress={async () => {
                    if (ready && store) {
                      try {
                        await store.completeCurrentLesson(lesson.id, 100, new Date().toISOString().slice(0, 10));
                        // Phase 30b: always re-read progress and fire the
                        // completion toast, even when there is no next lesson.
                        // The previous shape `if (next) setSelected(next.id)`
                        // silently did nothing on the last lesson, leaving the
                        // user staring at the same screen with no signal that
                        // anything happened.
                        const refreshed = await store.getProgress();
                        setProgress(refreshed);
                        notifyLessonCompleted({
                          message: `✓ ${lesson.title}`,
                          detail: `${refreshed.completedLessonIds.length} of ${lessons.length} lessons done total.`,
                        });
                        const next = nav.nextLesson();
                        if (next) {
                          setSelected(next.id);
                        } else {
                          // Course complete — bounce back to the lessons list
                          // so the user sees the celebration state instead of
                          // being stuck on this detail view.
                          setSelected(undefined);
                        }
                      } catch {
                        /* best-effort */
                      }
                    }
                  }}
                    testID="lesson-mark-complete-button"
                  />
                ) : (
                  <Card tone="success" shadow="none">
                    <Text style={styles.completedDetailTitle}>Completed</Text>
                    <Text style={styles.completedDetailBody}>This lesson is saved. Review it any time, or continue with the next unlocked lesson.</Text>
                  </Card>
                )}
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
                        {dailyLesson.isCourseComplete
                          ? 'Course complete 🎉'
                          : dailyLesson.isWeekPreview
                            ? 'New week unlocked!'
                            : `Week ${weekProgress.index}`}
                      </Text>
                    </View>
                    <Text style={styles.heroTitle}>
                      {dailyLesson.isCourseComplete
                        ? 'You finished every lesson!'
                        : currentWeek.label.replace(/^Week \d+ — /, '')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroMeta}>Theme: {currentWeek.theme}</Text>
                {dailyLesson.isCourseComplete ? (
                  <Text style={styles.heroMeta}>
                    {dailyLesson.lessonsDoneThisWeek} of {dailyLesson.lessonsTotalThisWeek} lessons done. Keep reviewing!
                  </Text>
                ) : null}
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
                  {dailyLesson.lessonsDoneThisWeek} of {dailyLesson.lessonsTotalThisWeek} {dailyLesson.isCourseComplete ? 'lessons done total' : 'lessons done this week'}
                </Text>
              </Card>

        {/* Phase 37c: weekly-todo gate UI. Rendered ONLY when
                    isTodoFeatureEnabled() is true so the default learner experience
                    (flag=false) is unchanged. When 37g flips the flag, the board
                    appears above the lesson path and the next-week CTA below is
                    disabled with a reason text until the prior week's todos are
                    all done. */}
                {isTodoFeatureEnabled() && todoBoard ? (
                  <View style={styles.todoBoardWrap}>
                    <Text style={styles.sectionTitle}>Weekly todos</Text>
                    <WeeklyTodoBoardView
                      board={todoBoard}
                      onTodoPress={(ctaRoute) => {
                        if (ctaRoute.screen === 'lesson' && ctaRoute.params?.lessonId) {
                          setSelected(ctaRoute.params.lessonId);
                        }
                        // Other kinds (flashcards / daily-rush / quiz / kanji /
                        // example-sentences) are 37d-1..5. The board already
                        // disables those CTAs so this branch is never hit for them.
                      }}
                    />
                  </View>
                ) : null}

                <Text style={styles.sectionTitle}>Lesson path</Text>
                <Card shadow="card">
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.pathTitle}>Week {lessonPath.currentWeek.week}</Text>
                    <Text style={styles.pathMeta}>{lessonPath.currentWeek.completedCount} of {lessonPath.currentWeek.totalCount} done</Text>
                  </View>
                  <View style={styles.lessonPathList}>
                    {lessonPath.currentWeek.lessons.map(item => (
                      <LessonPathRow key={item.lesson.id} item={item} onOpen={() => item.state === 'locked' ? undefined : setSelected(item.lesson.id)} />
                    ))}
                  </View>
                </Card>

                <View style={styles.ctaWrapper}>
                        <Button
                          label={
                            dailyLesson.isCourseComplete
                              ? 'Review lessons 🎉'
                              : dailyLesson.isWeekPreview
                                ? `Start Week ${weekProgress.index}`
                                : `Continue ${dailyLesson.lesson.title}`
                          }
                    onPress={() => {
                                setSelected(dailyLesson.lesson.id);
                              }}
                    iconRight="arrow-right"
                    variant="secondary"
                    testID="learn-continue-button"
                  />
                </View>

                {/* Phase 37c: next-week CTA gated by isWeekUnlocked. Hidden when
                    the todo feature is off so default learners see no change.
                    When the gate trips the CTA is disabled and the copy tells
                    the learner what is blocking them — but the prior week's
                    lesson list (above) is still visible per §11.1 strategy B
                    (preview-but-locked). */}
                {isTodoFeatureEnabled() && !dailyLesson.isCourseComplete ? (
                  <View style={styles.ctaWrapper}>
                    <Button
                      label={
                        nextWeekUnlocked
                          ? `Start Week ${nextWeekNumber}`
                          : `Finish Week ${weekProgress.index}'s todos to unlock Week ${nextWeekNumber}`
                      }
                      disabled={!nextWeekUnlocked}
                      onPress={() => {
                        const nextWeekFirstLesson = lessons.find(l => l.week === nextWeekNumber);
                        if (nextWeekFirstLesson) setSelected(nextWeekFirstLesson.id);
                      }}
                      iconRight={nextWeekUnlocked ? 'arrow-right' : undefined}
                      variant="soft"
                      testID="learn-next-week-button"
                    />
                  </View>
                ) : null}

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

function LessonPathRow({ item, onOpen }: { item: LessonPathItem; onOpen: () => void }) {
  const stateLabel = item.state === 'completed' ? 'Completed' : item.state === 'current' ? 'Current' : 'Locked';
  const statusIcon = item.state === 'completed' ? '✓' : item.state === 'current' ? '▶' : '🔒';
  return (
    <Pressable
      onPress={item.state === 'locked' ? undefined : onOpen}
      disabled={item.state === 'locked'}
      style={({ pressed }) => [styles.lessonPathRow, item.state === 'current' && styles.lessonPathRowCurrent, { opacity: item.state === 'locked' ? 0.65 : pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.lessonPathStatus, item.state === 'completed' && styles.lessonPathStatusDone, item.state === 'current' && styles.lessonPathStatusCurrent]}>
        <Text style={styles.lessonPathStatusIcon}>{statusIcon}</Text>
      </View>
      <View style={styles.lessonPathText}>
        <View style={styles.lessonPathTitleRow}>
          <Text style={styles.lessonPathLessonTitle} numberOfLines={2}>{item.lesson.title}</Text>
          <Text style={[styles.lessonPathState, item.state === 'completed' && styles.lessonPathStateDone]}>{stateLabel}</Text>
        </View>
        <Text style={styles.lessonPathHelper} numberOfLines={2}>{item.helperText}</Text>
        <Text style={styles.lessonPathAction} numberOfLines={2}>{item.primaryActionLabel}</Text>
      </View>
    </Pressable>
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
  todoBoardWrap: { gap: ds.spacing.sm },
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ds.spacing.sm, marginBottom: ds.spacing.sm },
  pathTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  pathMeta: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary },
  lessonPathList: { gap: ds.spacing.sm },
  lessonPathRow: { flexDirection: 'row', gap: ds.spacing.sm, alignItems: 'flex-start', padding: ds.spacing.sm, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt },
  lessonPathRowCurrent: { backgroundColor: ds.colors.brandSoft },
  lessonPathStatus: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.colors.border },
  lessonPathStatusDone: { backgroundColor: ds.colors.successSoft },
  lessonPathStatusCurrent: { backgroundColor: ds.colors.brand },
  lessonPathStatusIcon: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.text },
  lessonPathText: { flex: 1, minWidth: 0 },
  lessonPathTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: ds.spacing.sm },
  lessonPathLessonTitle: { flex: 1, minWidth: 0, fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, lineHeight: 20 },
  lessonPathState: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.textMuted, textTransform: 'uppercase' },
  lessonPathStateDone: { color: ds.colors.success },
  lessonPathHelper: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  lessonPathAction: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '900', marginTop: ds.spacing.xs },
  completedDetailTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.success },
  completedDetailBody: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
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