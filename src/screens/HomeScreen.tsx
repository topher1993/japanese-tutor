import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { HeroLogo } from '../components/HeroLogo';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakFlame } from '../components/StreakFlame';
import { WeeklyTodoBoardView } from '../components/WeeklyTodoBoardView';
import { getAllLessons, getDailyLesson } from '../services/lessonService';
import { buildLessonProgression } from '../services/lessonProgressionService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { getSupportLanguageDisplayName, getSupportTranslation } from '../services/supportLanguageService';
import { useLearningContext } from '../services/learningContext';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { getAllWeekPlans } from '../services/weeklyPlansService';
import {
  buildAllTodoBoards,
  type TodoPayload,
} from '../services/weeklyTodoService';
import { emptyTodoEventCounts } from '../types/weeklyTodo';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import { PlacementTestPanel } from './PlacementTestPanel';
import { ds } from '../theme/designSystem';

export function HomeScreen({
  supportLanguage = 'en',
  onStartLesson,
  onReviewDue,
  onOpenDailyRush,
}: {
  supportLanguage?: LearnerLanguage;
  onStartLesson?: () => void;
  onReviewDue?: () => void;
  onOpenDailyRush?: () => void;
}) {
  // Phase 30: read progress so the daily lesson copy reflects the
  // learner's actual completion state instead of always defaulting to
  // Week 1 Day 1.
  const { ready, store, srs } = useLearningContext();
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    store.getProgress()
      .then((p) => { if (!cancelled) setProgress(p); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, store]);
  const lesson = getDailyLesson(progress ?? undefined);
  const phrase = lesson.lesson.items[0];
  const primaryTranslation = getSupportTranslation(phrase, supportLanguage);
  const totalLessons = getAllLessons().length;
  const completedLessons = progress?.completedLessonIds.length ?? 0;
    const [showPlacement, setShowPlacement] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    // P0-02 + P0-03 fix: StreakFlame now reads from the persistent store, not a hardcoded 3.
    const [streak, setStreak] = useState<number>(0);
    const [dueCount, setDueCount] = useState<number>(0);
    useEffect(() => {
      if (!ready || !store) return;
      let cancelled = false;
      Promise.all([
        store.getDashboard().then(d => d.currentStreak),
        srs ? srs.dueCount() : Promise.resolve(0),
      ])
        .then(([s, d]) => { if (!cancelled) { setStreak(s); setDueCount(d); } })
        .catch(() => { if (!cancelled) { setStreak(0); setDueCount(0); } });
      return () => { cancelled = true; };
    }, [ready, store, srs]);
  const nextActionLabel = dueCount > 0
    ? `Review ${dueCount} due card${dueCount === 1 ? '' : 's'}`
    : completedLessons === 0
      ? "Start your first lesson"
      : "Continue today's lesson";
  const nextActionDetail = dueCount > 0
    ? 'Clear due review first, then do your lesson or Daily Rush.'
    : 'Finish one lesson, then use Daily Rush for quick recall.';

  // Phase 37e: build the per-week todo board for the current week, mirroring
  // the 37c LessonsScreen pattern. Gated behind `isTodoFeatureEnabled()` so
  // the flag-off default learner experience (replaced "Today's focus" Card)
  // is unchanged. When 37g flips the flag this new feed renders in place of
  // the legacy "Today's focus" Card. Proposal §8 phase-37e.
  const lessons = getAllLessons();
  const emptyProgress: LearnerProgress = {
    startedAt: '',
    completedLessonIds: [],
    quizScores: [],
    streak: { currentStreak: 0, longestStreak: 0 },
  };
  const homeProgress = progress ?? emptyProgress;
  const lessonPath = useMemo(
    () => buildLessonInteractionPath(lessons, homeProgress),
    [lessons, homeProgress],
  );
  const progression = buildLessonProgression(lessonPath.currentWeek.week);
  const currentWeekIndex = progression.currentWeekDetails().weekNumber;
  const todoPayload = useMemo<TodoPayload>(() => {
    const extended = store?.getExtendedProgress() ?? {
      todoStates: {},
      weekTodosInitialized: {},
      todoEventCounts: emptyTodoEventCounts(),
    };
    return {
      todoStates: extended.todoStates,
      weekTodosInitialized: extended.weekTodosInitialized,
      todoEventCounts: extended.todoEventCounts,
      completedLessonIds: homeProgress.completedLessonIds,
    };
  }, [homeProgress.completedLessonIds, store]);
  const todoBoards = useMemo(
    () => buildAllTodoBoards(getAllWeekPlans(), todoPayload, 'all', currentWeekIndex),
    [todoPayload, currentWeekIndex],
  );
  const homeTodoBoard = todoBoards[currentWeekIndex];
  const homeTodosEnabled = isTodoFeatureEnabled();
  const homeIncompleteTodos = homeTodoBoard
    ? homeTodoBoard.todos.filter(status => !status.completed)
    : [];
  // Map a ctaRoute to a Home-action. HomeScreen only owns onStartLesson and
  // onOpenDailyRush (wired via App.tsx); other destinations fall back to
  // opening today's lesson. Mirrors the spec: "Today's active todos … with
  // per-todo CTA that deep-links to the relevant screen via ctaRoute".
  function handleHomeTodoCta(ctaRoute: import('../services/weeklyTodoService').TodoCtaRoute): void {
    switch (ctaRoute.screen) {
      case 'daily-rush':
        if (onOpenDailyRush) onOpenDailyRush();
        return;
      case 'lessons':
      case 'lesson':
      case 'flashcards':
      case 'quiz':
      case 'kanji':
      case 'example-sentences':
      default:
        if (onStartLesson) onStartLesson();
        return;
    }
  }

  if (showPlacement) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setShowPlacement(false)} titleStyle={styles.backHeader} />
        <PlacementTestPanel onComplete={() => undefined} />
      </ScreenScaffold>
    );
  }

  return (
      <ScreenScaffold>
        <HeroLogo size={120} subtitle="まいにち、にほんごをべんきょうしよう" tone="muted" />

        <View style={styles.greetingRow}>
          <Mascot expression="base" size={64} />
          <View style={styles.greetingText}>
            <ScreenHeader
              title="Home"
              subtitle={`${getSupportLanguageDisplayName(supportLanguage)} • ${lesson.lesson.title}`}
            />
          </View>
        </View>

      <StreakFlame days={streak} />
      {/* Phase 37e: when `isTodoFeatureEnabled()` is true (gated to 37g
          rollout) the home screen replaces its existing "Today's focus"
          Card with a "Today's todos" feed drawn from
          buildAllTodoBoards[currentWeek]. In flag-off default mode the
          legacy "Today's focus" Card still renders so the existing
          learner-visible behavior is preserved. Proposal §8 phase-37e +
          §11.2. */}
      {homeTodosEnabled ? (
        <Card shadow="card" style={styles.todayTodosCard}>
          <View style={styles.todayTodosHeader}>
            <View style={styles.todayTodosIcon}>
              <Icon name="learn" size={18} />
            </View>
            <View style={styles.todayTodosCopy}>
              <Text style={styles.todayTodosLabel}>Today's todos</Text>
              <Text style={styles.todayTodosTitle}>Week {currentWeekIndex} — keep going</Text>
              <Text style={styles.todayTodosDetail}>
                {homeIncompleteTodos.length === 0
                  ? 'Nothing left for this week — you can advance.'
                  : `${homeIncompleteTodos.length} todo${homeIncompleteTodos.length === 1 ? '' : 's'} left to finish this week.`}
              </Text>
            </View>
          </View>
          {homeTodoBoard ? (
            <WeeklyTodoBoardView
              board={homeTodoBoard}
              onTodoPress={handleHomeTodoCta}
            />
          ) : (
            <Text style={styles.todayTodosEmpty}>No board built for Week {currentWeekIndex} yet.</Text>
          )}
        </Card>
      ) : (
        <Card shadow="card" style={styles.todayFocusCard}>
          <View style={styles.todayFocusHeader}>
            <View style={styles.todayFocusIcon}>
              <Icon name="learn" size={18} />
            </View>
            <View style={styles.todayFocusCopy}>
              <Text style={styles.todayFocusLabel}>Today's focus</Text>
              <Text style={styles.todayFocusTitle}>{nextActionLabel}</Text>
              <Text style={styles.todayFocusDetail}>{nextActionDetail}</Text>
            </View>
          </View>
          <View style={styles.todayStatsRow}>
            <Text style={styles.todayStat}>{completedLessons}/{totalLessons} lessons</Text>
            <Text style={styles.todayStat}>30 min plan</Text>
            <Text style={styles.todayStat}>10-card Rush</Text>
          </View>
        </Card>
      )}
      {streak >= 3 ? (
        <View style={styles.streakCelebrate}>
          <Mascot expression="happy" size={56} />
          <Text style={styles.streakCelebrateText}>{streak} days in a row — keep it up!</Text>
        </View>
      ) : null}
      {dueCount > 0 ? (
        <Card shadow="card" style={styles.reviewCard}>
          <Text style={styles.reviewHeadline}>{dueCount} card{dueCount === 1 ? '' : 's'} due for review</Text>
          <Text style={styles.reviewHint}>Tap below to start your review session now.</Text>
          {onReviewDue ? (
            <Button
              label={`Review ${dueCount} due card${dueCount === 1 ? '' : 's'} now`}
              onPress={onReviewDue}
              iconRight="arrow-right"
              variant="primary"
              testID="home-review-due-cta"
              style={styles.reviewCta}
            />
          ) : null}
        </Card>
      ) : null}


      <Card shadow="card" style={styles.dailyRushCard}>
        <View style={styles.dailyRushHeader}>
          <Mascot expression="celebrate" size={52} />
          <View style={styles.dailyRushCopy}>
            <Text style={styles.dailyRushTitle}>Daily Flashcard Rush</Text>
            <Text style={styles.dailyRushHint}>10 quick cards • 4 choices • Good/Again review labels.</Text>
          </View>
        </View>
        {onOpenDailyRush ? (
          <Button
            label="Start Daily Rush"
            onPress={onOpenDailyRush}
            iconRight="arrow-right"
            testID="home-daily-rush-cta"
            style={styles.dailyRushCta}
          />
        ) : null}
      </Card>

      <Card tone="brand" shadow="hero" style={styles.lessonHero}>
        <View style={styles.lessonLabelRow}>
          <Text style={styles.lessonLabel}>Today's lesson</Text>
          <View style={styles.lessonBadge}>
            <Text style={styles.lessonBadgeText}>{lesson.lesson.level} • Week {lesson.lesson.week} • {lesson.lessonsDoneThisWeek}/{lesson.lessonsTotalThisWeek} done</Text>
          </View>
        </View>
        <Text style={styles.lessonTitle}>{phrase.japanese}</Text>
        <Text style={styles.lessonRomaji}>{phrase.romaji}</Text>
        <View style={styles.lessonDivider} />
        <Text style={styles.lessonTranslation}>
          {primaryTranslation.label}: {primaryTranslation.text}
        </Text>
      </Card>

      <Button
        label="Start today's lesson"
        onPress={() => { if (onStartLesson) onStartLesson(); }}
        iconRight="arrow-right"
        testID="home-start-button"
      />

      <Disclosure title="Need help?" icon="help" open={showHelp} onToggle={() => setShowHelp(v => !v)}>
        <View style={styles.helpList}>
          <HelpLine icon="learn" label='"Lessons" — pick a topic' />
          <HelpLine icon="practice" label='"Flashcards" — review flashcards' />
          <HelpLine icon="test" label='"Quiz" — quick self-check' />
          <HelpLine icon="progress" label='"Progress" — your streak and stats' />
        </View>
        <Button label="Take the placement test" onPress={() => setShowPlacement(true)} variant="soft" icon="star" />
      </Disclosure>
    </ScreenScaffold>
  );
}

function HelpLine({ icon, label }: { icon: React.ComponentProps<typeof Icon>['name']; label: string }) {
  return (
    <View style={styles.helpLine}>
      <Icon name={icon} size={16} />
      <Text style={styles.helpLineText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md },
  greetingText: { flex: 1, minWidth: 0 },
  streakCelebrate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    backgroundColor: ds.colors.successSoft,
    padding: ds.spacing.sm,
    borderRadius: ds.radius.md,
  },
  streakCelebrateText: { fontSize: ds.type.body, fontWeight: '800', color: ds.colors.text, flexShrink: 1 },
  todayFocusCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  todayFocusHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  todayFocusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ds.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayFocusCopy: { flex: 1, minWidth: 0 },
  todayFocusLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  todayFocusTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  todayFocusDetail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  todayTodosCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  todayTodosHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  todayTodosIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ds.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayTodosCopy: { flex: 1, minWidth: 0 },
  todayTodosLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  todayTodosTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  todayTodosDetail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  todayTodosEmpty: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18 },
  todayStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginTop: ds.spacing.xs },
  todayStat: {
    fontSize: ds.type.micro,
    fontWeight: '900',
    color: ds.colors.text,
    backgroundColor: ds.colors.surfaceMuted,
    paddingHorizontal: ds.spacing.sm,
    paddingVertical: ds.spacing.xs,
    borderRadius: ds.radius.sm,
  },
  lessonHero: { padding: ds.spacing.lg, gap: ds.spacing.sm },
  lessonLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds.spacing.xs },
  lessonLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandInk, opacity: 0.85, textTransform: 'uppercase' },
  lessonBadge: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs, borderRadius: ds.radius.sm },
  lessonBadgeText: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.brandInk },
  lessonTitle: { fontSize: 32, fontWeight: '900', color: ds.colors.brandInk, lineHeight: 40, flexShrink: 1 },
  lessonRomaji: { fontSize: ds.type.heading, color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs, flexShrink: 1 },
  lessonDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: ds.spacing.sm },
  lessonTranslation: { fontSize: ds.type.body, color: ds.colors.brandInk, fontWeight: '800', flexShrink: 1, lineHeight: 22 },
  helpList: { gap: ds.spacing.xs },
  helpLine: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  helpLineText: { fontSize: ds.type.body, color: ds.colors.text, flexShrink: 1 },
  backHeader: { fontSize: ds.type.body },
  reviewCard: { padding: ds.spacing.md, gap: ds.spacing.xs, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  reviewHeadline: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  reviewHint: { fontSize: ds.type.caption, color: ds.colors.textMuted },
  reviewCta: { marginTop: ds.spacing.sm, alignSelf: 'flex-start' },
  dailyRushCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.warm },
  dailyRushHeader: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  dailyRushCopy: { flex: 1, minWidth: 0 },
  dailyRushTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  dailyRushHint: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  dailyRushCta: { marginTop: ds.spacing.xs },
});