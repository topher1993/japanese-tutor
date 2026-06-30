import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { answerCurrentQuestion, createQuizSession, finishQuizSession, getCurrentQuestion, getQuizSessionProgress } from '../services/quizSessionService';
import { getSupportLanguageDisplayName } from '../services/supportLanguageService';
import { getCandidateQuizCounts } from '../services/candidateQuizAdapter';
import type { LearnerLanguage } from '../types/onboarding';
import { ReviewModePanel } from './ReviewModePanel';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { ds } from '../theme/designSystem';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { useLearningContext } from '../services/learningContext';
import { getAllLessons } from '../services/lessonService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import type { LearnerProgress } from '../types/progress';

/**
 * Phase 37d-4 — derive the active week for a quiz attempt. Mirrors the
 * DailyRushScreen.deriveDailyRushWeekNumber / FlashcardsScreen helper:
 * read completedLessonIds from the persistence store and fall back to
 * week 1 when the learner has not started. QuizScreen does not own a
 * "currentLesson" of its own, so we reuse the lesson-path builder.
 */
function deriveQuizWeekNumber(progress: LearnerProgress | null | undefined): number {
  const safeProgress: LearnerProgress = progress ?? {
    startedAt: new Date().toISOString(),
    completedLessonIds: [],
    quizScores: [],
    streak: { currentStreak: 0, longestStreak: 0 },
  };
  const path = buildLessonInteractionPath(getAllLessons(), safeProgress);
  return path.currentLesson?.week ?? 1;
}

export function QuizScreen({ supportLanguage = 'en' }: { supportLanguage?: LearnerLanguage }) {
  const [session, setSession] = useState(createQuizSession());
  const [showReview, setShowReview] = useState(false);
  const question = getCurrentQuestion(session);
  const progress = getQuizSessionProgress(session);
  const result = session.complete ? finishQuizSession(session) : undefined;
  const candidateQuizCounts = getCandidateQuizCounts();

  // Phase 37d-4: when the quiz finishes, notify the practiceProgressStore so
  // the quiz todo gate (UI wired in 37c) records the best score. Mirrors
  // DailyRushScreen's useEffect-on-completion pattern. Guarded behind
  // isTodoFeatureEnabled() so default behavior is unchanged for non-37g
  // builds. Uses the LearningRepositoryProvider's store (opened once at app
  // boot) — do NOT open a fresh SQLite handle here.
  const { store: practiceStore } = useLearningContext();
  const [quizRecordedFingerprint, setQuizRecordedFingerprint] = useState<string | null>(null);
  useEffect(() => {
    if (!result) return;
    // QuizResult does not carry a sessionId, so we deduplicate by
    // `(score, total)` fingerprint. Two identical-scoring attempts in a
    // row will be a no-op; a different attempt produces a new fingerprint
    // and re-fires the store write (best-score merge happens in the store).
    const fingerprint = `${result.score}:${result.total}`;
    if (quizRecordedFingerprint === fingerprint) return;
    if (!isTodoFeatureEnabled() || !practiceStore) return;
    setQuizRecordedFingerprint(fingerprint);
    void (async () => {
      try {
        const score = result.total > 0
          ? Math.round((result.score / result.total) * 100)
          : 0;
        let weekNumber = 1;
        try {
          const progress = await practiceStore.getProgress();
          weekNumber = deriveQuizWeekNumber(progress);
        } catch {
          // progress read failed — leave default weekNumber = 1
        }
        await practiceStore.recordQuizAttempt(weekNumber, score);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[quiz] failed to record todo completion', err);
      }
    })();
  }, [result, practiceStore, quizRecordedFingerprint]);

  if (showReview) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Review Mode" onBack={() => setShowReview(false)} />
        <ReviewModePanel />
      </ScreenScaffold>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <ScreenScaffold>
      <ScreenHeader
        title="Test"
        subtitle={`Question ${progress.current} of ${progress.total} • ${getSupportLanguageDisplayName(supportLanguage)}`}
      />

      <Card tone="brand" shadow="hero" style={styles.progressHero}>
        <Text style={styles.progressLabel}>Progress</Text>
        <Text style={styles.progressValue}>{pct}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressMeta}>{candidateQuizCounts.total} questions in pool</Text>
      </Card>

      <Pressable onPress={() => setShowReview(true)} style={({ pressed }) => [styles.reviewLink, { opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="clock" size={16} />
        <Text style={styles.reviewLinkText}>Switch to Review Mode</Text>
        <Icon name="arrow-right" size={14} />
      </Pressable>

      {question ? (
        <Card tone="default" shadow="hero">
          <Text style={styles.questionLabel}>Question {progress.current}</Text>
          <Text style={styles.prompt}>{question.prompt}</Text>
          <View style={styles.options}>
            {question.choices.map(c => (
              <Pressable
                key={c.id}
                onPress={() => setSession(answerCurrentQuestion(session, c.id))}
                style={({ pressed }) => [styles.option, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={styles.optionLetter}>
                  <Text style={styles.optionLetterText}>{c.id.toUpperCase()}</Text>
                </View>
                <Text style={styles.optionText}>{c.text}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {result ? (
        <Card tone="warm" shadow="hero" style={styles.resultCard}>
          <Text style={styles.resultTitle}>Quiz complete!</Text>
          <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
          <View style={styles.divider} />
          {result.feedback.map(f => (
            <View key={f.questionId} style={styles.feedbackRow}>
              <Text style={styles.feedbackIcon}>{f.correct ? '✅' : '❌'}</Text>
              <Text style={styles.feedbackText}>{f.explanation}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  progressHero: { padding: ds.spacing.lg, gap: ds.spacing.xs },
  progressLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandInk, opacity: 0.85, textTransform: 'uppercase' },
  progressValue: { fontSize: ds.type.display, fontWeight: '900', color: ds.colors.brandInk, lineHeight: 38 },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden', marginTop: ds.spacing.xs },
  progressFill: { height: 8, backgroundColor: ds.colors.brandInk, borderRadius: 4 },
  progressMeta: { fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs },
  reviewLink: {
      flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm,
      paddingVertical: ds.spacing.sm,
      paddingHorizontal: ds.spacing.md,
      backgroundColor: ds.colors.surface,
      borderRadius: ds.radius.md,
      marginTop: ds.spacing.md,
      marginBottom: ds.spacing.xs,
      minHeight: ds.touch.min,
    },
  reviewLinkText: { flex: 1, fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  questionLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  prompt: { fontSize: ds.type.heading + 2, lineHeight: 28, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs, flexShrink: 1 },
  options: { marginTop: ds.spacing.md, gap: ds.spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm,
    paddingVertical: ds.spacing.sm,
    paddingHorizontal: ds.spacing.md,
    borderRadius: ds.radius.md,
    backgroundColor: ds.colors.surfaceAlt,
    minHeight: ds.touch.min,
    borderWidth: 1,
    borderColor: ds.colors.border,
  },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: ds.colors.brand, alignItems: 'center', justifyContent: 'center',
  },
  optionLetterText: { color: ds.colors.brandInk, fontWeight: '900', fontSize: ds.type.caption },
  optionText: { flex: 1, fontSize: ds.type.body, color: ds.colors.text, flexShrink: 1 },
  resultCard: { padding: ds.spacing.lg, gap: ds.spacing.xs },
  resultTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.warmInkStrong },
  resultScore: { fontSize: ds.type.display, fontWeight: '900', color: ds.colors.warmInkStrong },
  divider: { height: 1, backgroundColor: 'rgba(124,45,18,0.2)', marginVertical: ds.spacing.sm },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.xs, marginTop: ds.spacing.xs },
  feedbackIcon: { fontSize: 16 },
  feedbackText: { flex: 1, fontSize: ds.type.body, color: ds.colors.warmInkStrong, flexShrink: 1 },
});
