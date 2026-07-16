import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { getDailyLesson } from '../services/lessonService';
import { notifyLessonCompleted } from '../components/CompletionToast';
import { useLearningContext } from '../services/learningContext';
import { useUserProfileContext } from '../services/userProfileContext';
import { getVisibleTranslations } from '../services/supportLanguageService';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import { ds } from '../theme/designSystem';
import { localDateKey } from '../services/dailyTodoService';

/**
 * Phase 30 — Daily lesson screen with progress visibility.
 *
 * Previously this screen hardcoded `getDailyLesson()` (which always
 * returned Week 1 Day 1). It now reads the learner's actual progress so
 * the header copy, the lesson, and the completion CTA all reflect
 * where the learner really is in the curriculum.
 *
 * Note: this screen is not currently routed in `App.tsx` (the daily
 * lesson entry points inside `LessonsScreen` cover the user flow), but
 * it is kept up-to-date so a future routing change can use it without
 * re-implementing the progress wiring.
 */
export function DailyLessonScreen({ supportLanguage = 'en' }: { supportLanguage?: LearnerLanguage }) {
  const { ready, store } = useLearningContext();
  const { profile } = useUserProfileContext();
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    store.getProgress()
      .then((p) => { if (!cancelled) setProgress(p); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, store]);
  const view = getDailyLesson(progress ?? undefined, profile?.dynamic.placement?.level);
  const lesson = view.lesson;

  return (
    <ScreenScaffold>
      <ScreenHeader
        title="Daily Lesson"
        subtitle={`${view.weekLabel} • ${view.lessonsDoneThisWeek} of ${view.lessonsTotalThisWeek} done this week`}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card tone="brand" shadow="card">
          <Text style={styles.lessonBadge}>{lesson.level} • Week {lesson.week} • Day {lesson.day}</Text>
          <Text style={styles.title}>{lesson.title}</Text>
          <Text style={styles.objective}>{lesson.objective}</Text>
          {view.isWeekPreview ? (
            <Text style={styles.preview}>You finished Week {lesson.week - 1}! Tap "Start Week {lesson.week}" below to begin.</Text>
          ) : null}
          {view.isCourseComplete ? (
            <Text style={styles.preview}>🎉 You finished every lesson in the course. Keep reviewing!</Text>
          ) : null}
        </Card>
        {lesson.items.map(item => {
          const vocabulary = item.vocabulary;
          const translations = getVisibleTranslations(vocabulary ?? item, supportLanguage);
          return (
            <Card key={item.id} shadow="card">
              <Text style={styles.jp}>{vocabulary?.japanese ?? item.japanese}</Text>
              <Text style={styles.romaji}>{vocabulary?.romaji ?? item.romaji}</Text>
              <View style={styles.divider} />
              {translations.map(translation => (
                <Text
                  key={translation.label}
                  style={translation.label === 'English' ? styles.translation : styles.secondary}
                >
                  {translation.label}: {translation.text}
                </Text>
              ))}
              <Text style={styles.example}>{vocabulary?.examples?.[0]?.japanese ?? item.exampleJapanese} — {vocabulary?.examples?.[0]?.en ?? item.exampleEnglish}</Text>
            </Card>
          );
        })}
        <Button
          label={view.isCourseComplete ? 'Restart course' : `Mark "${lesson.title}" complete`}
          variant="primary"
          iconRight="check"
          disabled={view.isCourseComplete && (progress?.completedLessonIds.length ?? 0) >= view.lessonsTotalThisWeek}
          onPress={async () => {
            if (ready && store) {
              try {
                await store.completeCurrentLesson(lesson.id, 100, localDateKey());
                const refreshed = await store.getProgress();
                setProgress(refreshed);
                notifyLessonCompleted({
                  message: `✓ ${lesson.title}`,
                  detail: `${refreshed.completedLessonIds.length} lessons done total.`,
                });
              } catch {
                /* best-effort */
              }
            }
          }}
        />
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: ds.spacing.lg, paddingBottom: ds.spacing.xxl, gap: ds.spacing.md },
  lessonBadge: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginBottom: ds.spacing.xs },
  title: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.xs },
  objective: { fontSize: ds.type.body, color: ds.colors.textMuted },
  preview: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800', marginTop: ds.spacing.sm },
  jp: { fontSize: ds.type.display - 2, fontWeight: '900', color: ds.colors.text },
  romaji: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800', marginTop: ds.spacing.xs },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm },
  translation: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '800' },
  secondary: { fontSize: ds.type.body, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  example: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.sm, fontStyle: 'italic' },
});
