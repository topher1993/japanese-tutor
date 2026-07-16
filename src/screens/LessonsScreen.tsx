import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getGrammarLessons, getPhraseLessons } from '../services/lessonService';
// Phase 44.2: analytics — fires lesson_opened when the learner opens a
// lesson detail view. Lets us measure lesson engagement and which
// lessons get opened most.
import { track } from '../services/analyticsService';
import { createLessonNavigator } from '../services/lessonNavigatorService';
import { buildLessonProgression, type LessonProgression, type LessonWeek } from '../services/lessonProgressionService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { KanjiSectionPanel } from './KanjiSectionPanel';
import { getAdditionalLessonCategoryContent, getLocalizedAdditionalLessonPhrase } from '../services/additionalLessonContentService';
import { getVisibleTranslations } from '../services/supportLanguageService';
import { getLessonCategoryCards, type LessonCategoryCardId } from '../services/lessonCategoryService';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import { WorkplaceSurvivalScreen } from './WorkplaceSurvivalScreen';
import { ExampleSentencesScreen } from './ExampleSentencesScreen';
import { SentenceLabScreen } from './SentenceLabScreen';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { Mascot } from '../components/Mascot';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { TranslationStatusBadge } from '../components/TranslationStatusBadge';
import { JishoLink } from '../components/JishoLink';
import { WeeklyTodoBoardView } from '../components/WeeklyTodoBoardView';
import { LessonPathRow } from './lessons/LessonPathRow';
import { ToolRow } from './lessons/ToolRow';
import { useMarkComplete } from './lessons/useMarkComplete';
import { useWeeklyTodoGate } from './lessons/useWeeklyTodoGate';
import { useLearningContext } from '../services/learningContext';
import { useUserProfileContext } from '../services/userProfileContext';
import { lessonsForPlacementLevel, placementLevelToCourseLevel, type CourseLevel } from '../services/placementPathService';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import {
  isWeekUnlocked,
  type WeeklyTodoBoard,
} from '../services/weeklyTodoService';
import type { AppTab, LessonTool } from '../types/navigation';
import { ds } from '../theme/designSystem';

type GrammarFilter = 'all' | 'adjectives' | 'particles' | 'verbs' | 'conjugations';
type GrammarLevel = 'all' | 'N5' | 'N4' | 'N3';

function grammarLessonMatchesFilter(lesson: { title: string; objective: string; summary: string }, filter: GrammarFilter): boolean {
  if (filter === 'all') return true;
  const text = `${lesson.title} ${lesson.objective} ${lesson.summary}`.toLowerCase();
  if (filter === 'adjectives') return text.includes('adjective');
  if (filter === 'particles') return /particle|topic|subject|destination|location|demonstrative/.test(text);
  if (filter === 'verbs') return /verb|masu|dictionary|potential|passive|causative|keigo/.test(text);
  return /form|conjugat|past|present|negative|conditional|te-/.test(text);
}

export function LessonsScreen({
  supportLanguage = 'en',
  pendingLessonId,
  pendingLessonTool,
  onPendingDestinationHandled,
  initialTrack,
  onOpenTab,
  onOpenDailyRush,
  onOpenSentenceLab,
}: {
  supportLanguage?: LearnerLanguage;
  pendingLessonId?: string;
  pendingLessonTool?: LessonTool;
  onPendingDestinationHandled?: () => void;
  initialTrack?: 'phrases' | 'grammar';
  onOpenTab?: (tab: AppTab) => void;
  onOpenDailyRush?: () => void;
  onOpenSentenceLab?: () => void;
}) {
    const { profile } = useUserProfileContext();
    const placementLevel = profile?.dynamic.placement?.level;
    const recommendedCourseLevel = placementLevelToCourseLevel(placementLevel);
    const grammarRecommendedLevel: GrammarLevel = recommendedCourseLevel === 'Absolute Beginner' ? 'N5' : recommendedCourseLevel;
    // `null` means the placement-aware forward curriculum (start at the
    // recommended level, then continue upward). Selecting a level chip enters
    // an explicit single-level review view without changing placement.
    const [phraseReviewLevel, setPhraseReviewLevel] = useState<CourseLevel | null>(null);
    const phraseLessons = phraseReviewLevel
      ? getPhraseLessons().filter(lesson => lesson.level === phraseReviewLevel)
      : lessonsForPlacementLevel(getPhraseLessons(), placementLevel);
    const grammarTrackLessons = getGrammarLessons();
    const { ready, store } = useLearningContext();
    const categories = getLessonCategoryCards();
    const [progress, setProgress] = useState<LearnerProgress | null>(null);
    const [lessonTrack, setLessonTrack] = useState<'phrases' | 'grammar'>(initialTrack ?? 'phrases');
    const [grammarFilter, setGrammarFilter] = useState<GrammarFilter>('all');
    const [grammarLevel, setGrammarLevel] = useState<GrammarLevel>(placementLevel ? grammarRecommendedLevel : 'all');
    const [grammarWeek, setGrammarWeek] = useState<number | 'all'>('all');
    const grammarWeeks = Array.from(new Set(grammarTrackLessons.map(lesson => lesson.week))).sort((left, right) => left - right);
    const filteredGrammarLessons = grammarTrackLessons.filter(lesson =>
      grammarLessonMatchesFilter(lesson, grammarFilter)
      && (grammarLevel === 'all' || lesson.level === grammarLevel)
      && (grammarWeek === 'all' || lesson.week === grammarWeek),
    );
    const lessons = lessonTrack === 'grammar' ? filteredGrammarLessons : phraseLessons;
    const [selectedCategory, setSelectedCategory] = useState<LessonCategoryCardId | undefined>(undefined);
    const [selected, setSelected] = useState<string | undefined>(undefined);
    const [showExamples, setShowExamples] = useState(false);
    const [showSentenceLab, setShowSentenceLab] = useState(false);
    const nav = createLessonNavigator(lessons, selected);
    const lessonPath = buildLessonInteractionPath(
      lessons,
      progress ?? { startedAt: '', completedLessonIds: [], quizScores: [], streak: { currentStreak: 0, longestStreak: 0 } },
      lessonTrack === 'phrases' && phraseReviewLevel === null ? placementLevel : null,
    );
    const currentTrackLesson = lessonPath.currentLesson ?? lessons[0];
    const dailyLesson = currentTrackLesson ? {
      lesson: currentTrackLesson,
      weekLabel: lessonPath.courseComplete ? 'Course complete' : `Week ${currentTrackLesson.week} — Day ${currentTrackLesson.day}`,
      lessonsDoneThisWeek: lessonPath.currentWeek.completedCount,
      lessonsTotalThisWeek: lessonPath.currentWeek.totalCount,
      isWeekPreview: false,
      isCourseComplete: lessonPath.courseComplete,
    } : null;
    let progression = buildLessonProgression(lessonPath.currentWeek.week);
    const [showKanji, setShowKanji] = useState(false);
    const [showMore, setShowMore] = useState(false);
    // Phase 43: weekly-todo gate logic moved to useWeeklyTodoGate hook below.
    // Phase 43: markInFlight state moved into useMarkComplete hook.
    let currentWeek = progression.currentWeekDetails();
        let weekProgress = {
          index: lessonPath.currentWeek.week,
          total: progression.weeks.length,
          minutes: currentWeek.recommendedMinutes,
        };

        // Phase 43: weekly-todo gate logic moved to useWeeklyTodoGate hook.
                const gate = useWeeklyTodoGate({
                  store,
                  lessonPath,
                  weekProgress,
                  progression,
                  currentWeek,
                  progress,
                  track: lessonTrack,
                });
                const todoPayload = gate.todoPayload;
                const todoBoards = gate.todoBoards as Record<number, WeeklyTodoBoard>;
                const todoBoard = gate.todoBoard as WeeklyTodoBoard | undefined;
                const nextWeekNumber = gate.nextWeekNumber;
                const nextWeekUnlocked = gate.nextWeekUnlocked;
                const masteryPrerequisite = gate.masteryPrerequisite;
                const todoGateBlocksCurrentLessonWeek = lessonTrack === 'phrases' && gate.todoGateBlocksCurrentLessonWeek;
                const displayLessonPathWeek = lessonTrack === 'grammar'
                  ? lessonPath.currentWeek
                  : gate.displayLessonPathWeek as typeof lessonPath.weeks[number];
                // Phase 43: if the gate is active, the hook has re-derived
                // progression/currentWeek/weekProgress for the blocking week.
                // Reflect those re-derived values into the parent `let` bindings
                // so the rest of the function body (and the JSX below) uses them.
                if (lessonTrack === 'phrases' && gate.todoGateBlocksCurrentLessonWeek) {
                  progression = gate.progression as LessonProgression;
                  currentWeek = gate.currentWeek as LessonWeek;
                  weekProgress = gate.weekProgress;
                }

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
      if (initialTrack) setLessonTrack(initialTrack);
    }, [initialTrack]);

    useEffect(() => {
      setPhraseReviewLevel(null);
      setGrammarLevel(placementLevel ? grammarRecommendedLevel : 'all');
    }, [placementLevel, recommendedCourseLevel]);

    useEffect(() => {
      if (pendingLessonId) {
        setSelected(pendingLessonId);
        setSelectedCategory(undefined);
        setShowKanji(false);
        setShowMore(false);
        onPendingDestinationHandled?.();
      }
    }, [onPendingDestinationHandled, pendingLessonId]);

    useEffect(() => {
      if (!pendingLessonTool) return;
      setSelected(undefined);
      setSelectedCategory(undefined);
      setShowKanji(pendingLessonTool === 'kanji');
      setShowExamples(pendingLessonTool === 'example-sentences');
      setShowMore(false);
      onPendingDestinationHandled?.();
    }, [onPendingDestinationHandled, pendingLessonTool]);

    useEffect(() => {
      setSelected(undefined);
      setSelectedCategory(undefined);
      setShowKanji(false);
      setShowMore(false);
    }, [lessonTrack, phraseReviewLevel, grammarFilter, grammarLevel, grammarWeek]);

    // Phase 44.2: fire lesson_opened when the learner transitions from
    // the lesson list (no selection) into a lesson detail view. We only
    // fire on the transition (not on re-renders while already open), so
    // the dashboard counts opens, not renders.
    useEffect(() => {
      if (!selected) return;
      const lesson = lessons.find(l => l.id === selected);
      track('lesson_opened', {
        lessonId: selected,
        week: lesson && (lesson as { week?: number }).week,
      });
      // We intentionally depend only on `selected` (the id), so we
      // don't re-fire on every `lessons` array re-derivation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

  // Phase 39 (Igris mark-complete fix) — derive the selected lesson
  // UNCONDITIONALLY so the handler hook can sit at the top of the
  // component (matching Rules of Hooks). When no lesson is selected
  // the handler is a defensive no-op; the render branch below only
  // attaches it to the button when `selectedLesson` exists.
  const selectedLesson = nav.selectedLesson;

  // Phase 43: handleMarkComplete moved to useMarkComplete hook.
  const { markComplete: handleMarkComplete, markInFlight } = useMarkComplete({
    selectedLesson,
    store,
    lessons,
    setProgress,
    setSelected,
    todoTrack: lessonTrack,
  });

  if (showExamples) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setShowExamples(false)} titleStyle={styles.backHeader} />
        <ExampleSentencesScreen supportLanguage={supportLanguage} />
      </ScreenScaffold>
    );
  }

  if (showSentenceLab) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setShowSentenceLab(false)} titleStyle={styles.backHeader} />
        <SentenceLabScreen />
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
    const selectedLessonUnlockedByTodos = lessonTrack === 'grammar'
      || !isTodoFeatureEnabled()
      || selectedLessonCompleted
      || isWeekUnlocked(lesson.week, todoBoards, todoPayload);
    const selectedLessonLockedByTodos = !selectedLessonCompleted && !selectedLessonUnlockedByTodos;
    const nextLesson = nav.nextLesson();
    const nextLessonUnlockedByTodos = lessonTrack === 'grammar'
      || !nextLesson
      || !isTodoFeatureEnabled()
      || nextLesson.week === lesson.week
      || isWeekUnlocked(nextLesson.week, todoBoards, todoPayload);
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setSelected(undefined)} titleStyle={styles.backHeader} />
        <Card tone="brand" shadow="hero">
          <Text style={styles.lessonBadge}>{lesson.level} • Week {lesson.week}</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.lessonObjective}>{lesson.objective}</Text>
          {lesson.summary ? <Text style={styles.lessonSummary}>{lesson.summary}</Text> : null}
        </Card>
        <Text style={styles.sectionTitle}>{lesson.items.length} {lesson.category === 'grammar' ? 'rules' : 'phrases'}</Text>
        {lesson.items.map((item, idx) => {
          const vocabulary = item.vocabulary;
          const japanese = vocabulary?.japanese ?? item.japanese;
          const romaji = vocabulary?.romaji ?? item.romaji;
          const example = vocabulary?.examples?.[0];
          return (
            <Card key={item.id} shadow="card">
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemIndex}>{lesson.category === 'grammar' ? 'Rule' : 'Phrase'} {idx + 1}</Text>
                <TranslationStatusBadge status={item.translationReviewStatus} supportLanguage={supportLanguage} />
              </View>
              {lesson.category === 'grammar' ? (
                <>
                  <Text style={styles.rulePattern}>{japanese}</Text>
                  <Text style={styles.ruleFormation}>Formation: {item.formation ?? romaji}</Text>
                  <View style={styles.divider} />
                  <Text style={styles.translation}>Rule: {vocabulary?.meanings.en.join('; ') ?? item.english}</Text>
                  <Text style={styles.exampleJapanese}>{example?.japanese ?? item.exampleJapanese}</Text>
                  {(example?.romaji ?? item.exampleRomaji) ? <Text style={styles.exampleRomaji}>{example?.romaji ?? item.exampleRomaji}</Text> : null}
                  <Text style={styles.exampleEnglish}>Example: {example?.en ?? item.exampleEnglish}</Text>
                  {item.commonMistake ? <Text style={styles.commonMistake}>Common mistake: {item.commonMistake}</Text> : null}
                </>
              ) : (
                <>
                  <Text style={styles.jp}>{japanese}</Text>
                  <View style={styles.jpMetaRow}>
                    <Text style={styles.romaji}>{romaji}</Text>
                    <JishoLink japanese={japanese} />
                  </View>
                  <View style={styles.divider} />
                  {getVisibleTranslations(vocabulary ?? item, supportLanguage).map(translation => (
                    <Text
                      key={translation.label}
                      style={translation.label === 'English' ? styles.translation : styles.secondaryTranslation}
                    >
                      {translation.label}: {translation.text}
                    </Text>
                  ))}
                </>
              )}
            </Card>
          );
        })}
        {selectedLessonCompleted && nextLesson && nextLessonUnlockedByTodos ? (
                  <Button
                    label={`Next: ${nextLesson.title}`}
                    onPress={() => setSelected(nextLesson.id)}
                    variant="secondary"
                    iconRight="arrow-right"
                  />
                ) : null}
                {selectedLessonLockedByTodos ? (
                  <Card tone="warm" shadow="none" style={styles.todoLockedCard}>
                    <Text style={styles.todoLockedTitle}>
                      {masteryPrerequisite.allowed ? 'Finish this week’s todos first' : 'Strengthen prerequisite mastery first'}
                    </Text>
                    <Text style={styles.completedDetailBody}>
                      {masteryPrerequisite.allowed
                        ? `Week ${lesson.week} is open for preview, but completion is locked until the previous week's todos are done.`
                        : `${masteryPrerequisite.reason} Current overall mastery: ${masteryPrerequisite.score}%.`}
                    </Text>
                  </Card>
                ) : null}
                {!selectedLessonCompleted && !selectedLessonLockedByTodos ? (
                  <Button
                    label={markInFlight ? "Saving lesson..." : "Mark this lesson complete"}
                    variant="primary"
                    // Phase 40: do NOT show the green check on the
                    // incomplete-state CTA. The check glyph made the
                    // button look completed while still saying "Mark
                    // this lesson complete", which masked whether a
                    // tap had landed. The completed branch below owns
                    // the success/check state.
                    onPress={handleMarkComplete}
                    // Phase 40: only disable while the completion
                    // request is actually in flight. If `store` is not
                    // ready, keep the CTA tappable so handleMarkComplete
                    // can surface `store-unavailable` via LessonErrorToast
                    // instead of becoming a silent disabled button.
                    disabled={markInFlight}
                    testID="lesson-mark-complete-button"
                  />
                ) : selectedLessonCompleted ? (
                  <Card tone="success" shadow="none">
                    <Text style={styles.completedDetailTitle}>Completed</Text>
                    <Text style={styles.completedDetailBody}>This lesson is saved. Review it any time, or continue with the next unlocked lesson.</Text>
                  </Card>
                ) : null}
              </ScreenScaffold>
            );
          }

  if (!currentTrackLesson || !dailyLesson) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Lessons" />
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="lessons" size={220} />
          <Text style={styles.emptyTitle}>No lessons match these filters</Text>
          <Text style={styles.emptyBody}>Choose another level, week, or grammar topic to continue.</Text>
        </View>
      </ScreenScaffold>
    );
  }

  const heroObjectives = lessonTrack === 'grammar'
    ? [
        currentTrackLesson.objective,
        currentTrackLesson.summary,
        'Study each formation, example, and common mistake before moving on.',
      ]
    : currentWeek.objectives;

  return (
      <ScreenScaffold>
        <ScreenHeader
          title="Lessons"
          subtitle={`Week ${weekProgress.index} of ${weekProgress.total} • ${dailyLesson.lessonsDoneThisWeek} of ${dailyLesson.lessonsTotalThisWeek} lessons done • ${weekProgress.minutes} min`}
        />

        <View style={styles.trackSwitcher} accessibilityRole="tablist">
          <Chip label="Phrases" selected={lessonTrack === 'phrases'} onPress={() => setLessonTrack('phrases')} />
          {placementLevel !== 'absolute-beginner' ? (
            <Chip label="Grammar rules" selected={lessonTrack === 'grammar'} onPress={() => setLessonTrack('grammar')} />
          ) : null}
        </View>
        {lessonTrack === 'phrases' ? (
          <View style={styles.filterPanel} accessibilityRole="tablist">
            <Text style={styles.filterLabel}>Lesson level</Text>
            <View style={styles.chipRow}>
              <Chip label="My path" selected={phraseReviewLevel === null} onPress={() => setPhraseReviewLevel(null)} />
              {(['Absolute Beginner', 'N5', 'N4', 'N3'] as CourseLevel[]).map(level => (
                <Chip key={level} label={level === 'Absolute Beginner' ? 'Start here' : level} selected={phraseReviewLevel === level} onPress={() => setPhraseReviewLevel(level)} />
              ))}
            </View>
          </View>
        ) : null}
        {lessonTrack === 'grammar' ? (
          <View style={styles.filterPanel} accessibilityRole="tablist">
            <Text style={styles.filterLabel}>Filter grammar lessons</Text>
            <View style={styles.chipRow}>
              {([
                ['all', 'All rules'],
                ['adjectives', 'Adjectives'],
                ['particles', 'Particles'],
                ['verbs', 'Verb forms'],
                ['conjugations', 'Conjugations'],
              ] as Array<[GrammarFilter, string]>).map(([value, label]) => (
                <Chip key={value} label={label} selected={grammarFilter === value} onPress={() => setGrammarFilter(value)} />
              ))}
            </View>
            <View style={styles.chipRow}>
              {(['all', 'N5', 'N4', 'N3'] as GrammarLevel[]).map(level => (
                <Chip key={level} label={level === 'all' ? 'All levels' : level} selected={grammarLevel === level} onPress={() => setGrammarLevel(level)} />
              ))}
              <Chip label="All weeks" selected={grammarWeek === 'all'} onPress={() => setGrammarWeek('all')} />
              {grammarWeeks.map(week => (
                <Chip key={week} label={`Week ${week}`} selected={grammarWeek === week} onPress={() => setGrammarWeek(week)} />
              ))}
            </View>
          </View>
        ) : null}

        <Card tone="brand" shadow="hero" style={styles.heroCard}>
                <View style={styles.heroHeader}>
                  <Mascot expression="encourage" size={56} />
                  <View style={styles.heroTextWrap}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>
                        {todoGateBlocksCurrentLessonWeek
                          ? `Week ${weekProgress.index}`
                          : dailyLesson.isCourseComplete
                            ? 'Course complete 🎉'
                            : dailyLesson.isWeekPreview
                              ? 'New week unlocked!'
                              : `Week ${weekProgress.index}`}
                      </Text>
                    </View>
                    <Text style={styles.heroTitle}>
                      {lessonTrack === 'grammar'
                        ? 'Grammar Rules & Conjugations'
                        : dailyLesson.isCourseComplete
                        ? 'You finished every lesson!'
                        : currentWeek.label.replace(/^Week \d+ — /, '')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroMeta}>Theme: {lessonTrack === 'grammar' ? 'grammar and conjugation' : currentWeek.theme}</Text>
                {dailyLesson.isCourseComplete ? (
                  <Text style={styles.heroMeta}>
                    {dailyLesson.lessonsDoneThisWeek} of {dailyLesson.lessonsTotalThisWeek} lessons done. Keep reviewing!
                  </Text>
                ) : null}
                {todoGateBlocksCurrentLessonWeek ? (
                  <Text style={styles.heroMeta}>
                    Finish Week {weekProgress.index}'s todos to unlock Week {nextWeekNumber}.
                  </Text>
                ) : null}
                {dailyLesson.isWeekPreview && !todoGateBlocksCurrentLessonWeek ? (
                  <Text style={styles.heroMeta}>
                    You finished Week {weekProgress.index - 1}. Tap below to start Week {weekProgress.index}.
                  </Text>
                ) : null}
                {heroObjectives.map((objective, idx) => (
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
                    <Text style={styles.sectionTitle}>{lessonTrack === 'grammar' ? 'Grammar weekly goals' : 'Weekly todos'}</Text>
                    <WeeklyTodoBoardView
                      board={todoBoard}
                      onTodoPress={(ctaRoute) => {
                        switch (ctaRoute.screen) {
                          case 'lesson':
                            if (ctaRoute.params?.lessonId) setSelected(ctaRoute.params.lessonId);
                            return;
                          case 'lessons':
                            // Already on the Lessons tab; nothing to do.
                            return;
                          case 'flashcards':
                            onOpenTab?.('Flashcards');
                            return;
                          case 'quiz':
                            onOpenTab?.('Quiz');
                            return;
                          case 'kanji':
                            setShowKanji(true);
                            return;
                          case 'daily-rush':
                            onOpenDailyRush?.();
                            return;
                          case 'example-sentences':
                            setShowExamples(true);
                            return;
                        }
                      }}
                    />
                  </View>
                ) : null}

                <Text style={styles.sectionTitle}>Lesson path</Text>
                <Card shadow="card">
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.pathTitle}>Week {displayLessonPathWeek.week}</Text>
                    <Text style={styles.pathMeta}>{displayLessonPathWeek.completedCount} of {displayLessonPathWeek.totalCount} done</Text>
                  </View>
                  <View style={styles.lessonPathList}>
                    {displayLessonPathWeek.lessons.map(item => (
                      <LessonPathRow key={item.lesson.id} item={item} onOpen={() => item.state === 'locked' ? undefined : setSelected(item.lesson.id)} />
                    ))}
                  </View>
                </Card>

                <View style={styles.ctaWrapper}>
                        <Button
                          label={
                            todoGateBlocksCurrentLessonWeek
                              ? `Finish Week ${weekProgress.index}'s todos to unlock Week ${nextWeekNumber}`
                              : dailyLesson.isCourseComplete
                                ? 'Review lessons 🎉'
                                : dailyLesson.isWeekPreview
                                  ? `Start Week ${weekProgress.index}`
                                  : `Continue ${dailyLesson.lesson.title}`
                          }
                    onPress={() => {
                                if (todoGateBlocksCurrentLessonWeek) return;
                                setSelected(dailyLesson.lesson.id);
                              }}
                    disabled={todoGateBlocksCurrentLessonWeek}
                    iconRight={todoGateBlocksCurrentLessonWeek ? undefined : 'arrow-right'}
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
                {lessonTrack === 'phrases' && isTodoFeatureEnabled() && !dailyLesson.isCourseComplete ? (
                  <View style={styles.ctaWrapper}>
                    <Button
                      label={
                        nextWeekUnlocked
                          ? `Start Week ${nextWeekNumber}`
                          : masteryPrerequisite.allowed
                            ? `Finish Week ${weekProgress.index}'s todos to unlock Week ${nextWeekNumber}`
                            : `Reach prerequisite mastery to unlock Week ${nextWeekNumber}`
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

      {lessonTrack === 'phrases' ? <>
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
          icon="play"
          label="Listening & Sentence Lab"
          hint="Listen, rebuild sentences, and review mistakes"
          onPress={() => onOpenSentenceLab ? onOpenSentenceLab() : setShowSentenceLab(true)}
        />
        {placementLevel !== 'absolute-beginner' ? (
          <ToolRow
            icon="kanji"
            label="Kanji section"
            hint="Learn the characters"
            onPress={() => setShowKanji(true)}
          />
        ) : null}
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
      </> : null}
    </ScreenScaffold>
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
  trackSwitcher: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm },
  filterPanel: { gap: ds.spacing.xs, padding: ds.spacing.sm, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt },
  filterLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
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
  lessonSummary: { fontSize: ds.type.caption, color: ds.colors.brandInk, opacity: 0.78, marginTop: ds.spacing.sm, lineHeight: 19, flexShrink: 1 },
  itemIndex: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  rulePattern: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  ruleFormation: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '800', marginTop: ds.spacing.xs, flexShrink: 1 },
  exampleJapanese: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '900', marginTop: ds.spacing.sm, flexShrink: 1 },
  exampleRomaji: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '800', marginTop: ds.spacing.xs, flexShrink: 1 },
  exampleEnglish: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, flexShrink: 1 },
  commonMistake: { fontSize: ds.type.caption, color: ds.colors.warmInkStrong, marginTop: ds.spacing.sm, lineHeight: 18, flexShrink: 1 },
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
  completedDetailTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.success },
  completedDetailBody: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  todoLockedCard: { gap: ds.spacing.xs },
  todoLockedTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.warmInkStrong },
  backHeader: { fontSize: ds.type.body },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1 },
});
