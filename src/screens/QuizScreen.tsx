import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  answerQuizPracticeQuestion,
  buildRetryMissedQuizSession,
  buildQuizPracticeSession,
  finishQuizPracticeSession,
  getCurrentPracticeQuestion,
  getQuizPracticeModeBreakdown,
  getQuizPracticeProgress,
  type BuilderPracticeQuestion,
  type QuizPracticeSession,
} from '../services/quizPracticeService';
import { getSupportLanguageDisplayName } from '../services/supportLanguageService';
import { getCandidateQuizCounts } from '../services/candidateQuizAdapter';
import type { LearnerLanguage } from '../types/onboarding';
import type { QuizContentSource, QuizPracticeMode } from '../types/quiz';
import { ReviewModePanel } from './ReviewModePanel';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { Icon } from '../components/Icon';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { ds } from '../theme/designSystem';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { useLearningContext } from '../services/learningContext';
import { speakJapanese } from '../services/speechPracticeService';
import { resolveActivePhraseWeek } from '../services/activeLessonWeekService';
import { useUserProfileContext } from '../services/userProfileContext';

const MODE_OPTIONS: Array<{ value: QuizPracticeMode; label: string }> = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'listening', label: 'Listening' },
  { value: 'builder', label: 'Sentence builder' },
  { value: 'fillBlank', label: 'Fill in the blank' },
];

const SOURCE_OPTIONS: Array<{ value: QuizContentSource; label: string }> = [
  { value: 'mixed', label: 'All content' },
  { value: 'phrases', label: 'Phrases' },
  { value: 'grammar', label: 'Grammar rules' },
];

export function QuizScreen({
  supportLanguage = 'en',
  onOpenJlptExam,
}: {
  supportLanguage?: LearnerLanguage;
  onOpenJlptExam?: () => void;
}) {
  const [mode, setMode] = useState<QuizPracticeMode>('mixed');
  const [source, setSource] = useState<QuizContentSource>('mixed');
  const [session, setSession] = useState<QuizPracticeSession>(() => buildQuizPracticeSession('mixed', 'mixed'));
  const [showReview, setShowReview] = useState(false);
  const [selectedBuilderTokenIds, setSelectedBuilderTokenIds] = useState<string[]>([]);
  const [fillAnswer, setFillAnswer] = useState('');
  const question = getCurrentPracticeQuestion(session);
  const progress = getQuizPracticeProgress(session);
  const result = session.complete ? finishQuizPracticeSession(session) : undefined;
  const modeBreakdown = result ? getQuizPracticeModeBreakdown(session, result) : [];
  const missedCount = result?.feedback.filter(feedback => !feedback.correct).length ?? 0;
  const candidateQuizCounts = getCandidateQuizCounts();

  const { store: practiceStore } = useLearningContext();
  const { profile } = useUserProfileContext();
  const placementLevel = profile?.dynamic.placement?.level;
  const [quizRecordedFingerprint, setQuizRecordedFingerprint] = useState<string | null>(null);

  useEffect(() => {
    setSession(buildQuizPracticeSession(mode, source));
  }, [mode, source]);

  useEffect(() => {
    setSelectedBuilderTokenIds([]);
    setFillAnswer('');
  }, [question?.id]);

  function startAnotherTest() {
    setQuizRecordedFingerprint(null);
    setSession(buildQuizPracticeSession(mode, source));
  }

  function retryMissedQuestions() {
    if (!result || missedCount === 0) return;
    setQuizRecordedFingerprint(null);
    setSession(buildRetryMissedQuizSession(session));
  }

  useEffect(() => {
    if (!result) return;
    // A selector can update one render before its effect replaces the
    // finished session. Attribute completion to the session that produced it.
    const completedMode = session.mode;
    const completedSource = session.source;
    const fingerprint = `${completedMode}:${completedSource}:${result.score}:${result.total}`;
    if (quizRecordedFingerprint === fingerprint) return;
    if (!practiceStore) return;
    setQuizRecordedFingerprint(fingerprint);
    void (async () => {
      try {
        const score = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
        let weekNumber = 1;
        try {
          const storedProgress = await practiceStore.getProgress();
          weekNumber = resolveActivePhraseWeek(storedProgress, placementLevel);
        } catch {
          // Keep the default week when progress cannot be read.
        }
        if (isTodoFeatureEnabled()) {
          await practiceStore.recordQuizAttempt(weekNumber, score);
        }
        await practiceStore.recordQuizHistory({
          id: `${Date.now()}-${completedMode}-${completedSource}-${result.score}-${result.total}`,
          completedAt: new Date().toISOString(),
          weekNumber,
          mode: completedMode,
          source: completedSource,
          score: result.score,
          total: result.total,
        });
      } catch (err) {
        if (__DEV__) console.warn('[quiz] failed to record todo completion', err);
      }
    })();
  }, [result, session.mode, session.source, practiceStore, quizRecordedFingerprint, placementLevel]);

  function answer(value: string) {
    setSession(current => answerQuizPracticeQuestion(current, value));
  }

  function addBuilderToken(questionToBuild: BuilderPracticeQuestion, tokenId: string) {
    if (selectedBuilderTokenIds.includes(tokenId)) return;
    setSelectedBuilderTokenIds(current => [...current, tokenId]);
    if (selectedBuilderTokenIds.length + 1 === questionToBuild.tokens.length) {
      // The button remains visible so the learner can review the full order before submitting.
    }
  }

  function removeBuilderToken(tokenId: string) {
    setSelectedBuilderTokenIds(current => current.filter(id => id !== tokenId));
  }

  if (showReview) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Review Mode" onBack={() => setShowReview(false)} />
        <ReviewModePanel />
      </ScreenScaffold>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  if (!question && !result) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Test" subtitle={getSupportLanguageDisplayName(supportLanguage)} />
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="quiz" size={180} />
          <Text style={styles.emptyTitle}>No questions available</Text>
          <Text style={styles.emptyBody}>There are not enough approved questions for this quiz mode yet.</Text>
        </View>
      </ScreenScaffold>
    );
  }

  const selectedBuilderTokens = question?.kind === 'builder'
    ? selectedBuilderTokenIds.map(id => question.tokens.find(token => token.id === id)).filter(Boolean)
    : [];

  return (
    <ScreenScaffold>
      <ScreenHeader
        title="Test"
        subtitle={`Question ${progress.current} of ${progress.total} • ${getSupportLanguageDisplayName(supportLanguage)}`}
      />

      {onOpenJlptExam ? (
        <Card tone="warm" shadow="hero" style={styles.jlptCard}>
          <View style={styles.jlptHeadingRow}>
            <Icon name="clock" size={20} />
            <View style={styles.jlptHeadingCopy}>
              <Text style={styles.jlptTitle}>JLPT-style Mock Exam</Text>
              <Text style={styles.jlptSubtitle}>Timed N5, N4, and N3 section practice with autosave and resume.</Text>
            </View>
          </View>
          <Text style={styles.jlptDisclaimer}>Unofficial practice. Not affiliated with or endorsed by the Japan Foundation or JEES.</Text>
          <Button label="Open mock exams" onPress={onOpenJlptExam} variant="primary" icon="arrow-right" />
        </Card>
      ) : null}

      <View style={styles.modeSection} accessibilityRole="tablist">
        <Text style={styles.selectorLabel}>Quiz type</Text>
        <View style={styles.chipRow}>
          {MODE_OPTIONS.map(option => (
            <Chip key={option.value} label={option.label} selected={mode === option.value} onPress={() => setMode(option.value)} />
          ))}
        </View>
        <Text style={styles.selectorLabel}>Content</Text>
        <View style={styles.chipRow}>
          {SOURCE_OPTIONS.map(option => (
            <Chip key={option.value} label={option.label} selected={source === option.value} onPress={() => setSource(option.value)} />
          ))}
        </View>
      </View>

      <Card tone="brand" shadow="hero" style={styles.progressHero}>
        <Text style={styles.progressLabel}>Progress</Text>
        <Text style={styles.progressValue}>{pct}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressMeta}>{progress.total} questions in this session • {candidateQuizCounts.total} authored questions available</Text>
      </Card>

      <Pressable accessibilityRole="button" accessibilityLabel="Switch to Review Mode" onPress={() => setShowReview(true)} style={({ pressed }) => [styles.reviewLink, { opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="clock" size={16} />
        <Text style={styles.reviewLinkText}>Switch to Review Mode</Text>
        <Icon name="arrow-right" size={14} />
      </Pressable>

      {question ? (
        <Card tone="default" shadow="hero">
          <Text style={styles.questionLabel}>Question {progress.current} • {question.kind === 'fillBlank' ? 'Fill in the blank' : question.kind}</Text>
          <Text style={styles.prompt}>{question.prompt}</Text>

          {question.kind === 'listening' ? (
            <Button label="Play Japanese audio" icon="play" variant="soft" onPress={() => speakJapanese(question.audioText)} style={styles.audioButton} />
          ) : null}

          {question.kind === 'choice' || question.kind === 'listening' ? (
            <View style={styles.options}>
              {question.choices.map(choice => (
                <Pressable
                  key={choice.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.id}. ${choice.text}`}
                  onPress={() => answer(choice.id)}
                  style={({ pressed }) => [styles.option, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{choice.id}</Text></View>
                  <Text style={styles.optionText}>{choice.text}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {question.kind === 'builder' ? (
            <View style={styles.builderSection}>
              <Text style={styles.builderHint}>Tap the romaji blocks in the correct order.</Text>
              <View style={styles.selectedTokens}>
                {selectedBuilderTokens.map(token => token ? (
                  <Pressable key={token.id} onPress={() => removeBuilderToken(token.id)} style={styles.selectedToken}>
                    <Text style={styles.selectedTokenText}>{token.text}</Text>
                  </Pressable>
                ) : null)}
              </View>
              <View style={styles.tokenPool}>
                {question.tokens.filter(token => !selectedBuilderTokenIds.includes(token.id)).map(token => (
                  <Pressable key={token.id} onPress={() => addBuilderToken(question, token.id)} style={styles.token}>
                    <Text style={styles.tokenText}>{token.text}</Text>
                  </Pressable>
                ))}
              </View>
              <Button
                label="Check sentence"
                variant="primary"
                disabled={selectedBuilderTokenIds.length !== question.tokens.length}
                onPress={() => answer(selectedBuilderTokenIds.join('|'))}
              />
            </View>
          ) : null}

          {question.kind === 'fillBlank' ? (
            <View style={styles.fillSection}>
              <Text style={styles.fillSentence}>{question.sentenceTemplate}</Text>
              <TextInput
                value={fillAnswer}
                onChangeText={setFillAnswer}
                placeholder="Type the missing form"
                placeholderTextColor={ds.colors.textMuted}
                autoCapitalize="none"
                style={styles.fillInput}
                accessibilityLabel="Fill in the blank answer"
              />
              <Text style={styles.fillHint}>Hint: {question.hint}</Text>
              <Button label="Check answer" variant="primary" disabled={!fillAnswer.trim()} onPress={() => answer(fillAnswer.trim())} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <Card tone="warm" shadow="hero" style={styles.resultCard}>
          <Text style={styles.resultTitle}>Quiz complete!</Text>
          <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
          <Text style={styles.resultSummary}>Review by question type</Text>
          <View style={styles.breakdownList}>
            {modeBreakdown.map(item => (
              <View key={item.kind} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownScore}>{item.score} / {item.total}</Text>
              </View>
            ))}
          </View>
          <View style={styles.divider} />
          {result.feedback.map(feedback => (
            <View key={feedback.questionId} style={styles.feedbackRow}>
              <Text style={styles.feedbackIcon}>{feedback.correct ? '✅' : '❌'}</Text>
              <Text style={styles.feedbackText}>{feedback.correct ? 'Correct. ' : 'Review. '}{feedback.explanation}</Text>
            </View>
          ))}
          {missedCount > 0 ? (
            <Button label={`Retry missed (${missedCount})`} onPress={retryMissedQuestions} variant="secondary" icon="refresh" />
          ) : null}
          <Button label="Try another test" onPress={startAnotherTest} variant="primary" icon="refresh" />
        </Card>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  jlptCard: { padding: ds.spacing.lg, gap: ds.spacing.sm },
  jlptHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  jlptHeadingCopy: { flex: 1, gap: ds.spacing.xs },
  jlptTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.warmInkStrong },
  jlptSubtitle: { fontSize: ds.type.body, color: ds.colors.warmInkStrong, flexShrink: 1 },
  jlptDisclaimer: { fontSize: ds.type.caption, color: ds.colors.warmInkStrong, opacity: 0.84 },
  modeSection: { gap: ds.spacing.xs },
  selectorLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginTop: ds.spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  progressHero: { padding: ds.spacing.lg, gap: ds.spacing.xs },
  progressLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandInk, opacity: 0.85, textTransform: 'uppercase' },
  progressValue: { fontSize: ds.type.display, fontWeight: '900', color: ds.colors.brandInk, lineHeight: 38 },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden', marginTop: ds.spacing.xs },
  progressFill: { height: 8, backgroundColor: ds.colors.brandInk, borderRadius: 4 },
  progressMeta: { fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs },
  reviewLink: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingVertical: ds.spacing.sm, paddingHorizontal: ds.spacing.md, backgroundColor: ds.colors.surface, borderRadius: ds.radius.md, marginTop: ds.spacing.md, marginBottom: ds.spacing.xs, minHeight: ds.touch.min },
  reviewLinkText: { flex: 1, fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  questionLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  prompt: { fontSize: ds.type.heading + 2, lineHeight: 28, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs, flexShrink: 1 },
  audioButton: { marginTop: ds.spacing.md },
  options: { marginTop: ds.spacing.md, gap: ds.spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingVertical: ds.spacing.sm, paddingHorizontal: ds.spacing.md, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt, minHeight: ds.touch.min, borderWidth: 1, borderColor: ds.colors.border },
  optionLetter: { width: 32, height: 32, borderRadius: 16, backgroundColor: ds.colors.brand, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { color: ds.colors.brandInk, fontWeight: '900', fontSize: ds.type.caption },
  optionText: { flex: 1, fontSize: ds.type.body, color: ds.colors.text, flexShrink: 1 },
  builderSection: { marginTop: ds.spacing.md, gap: ds.spacing.sm },
  builderHint: { fontSize: ds.type.caption, color: ds.colors.textMuted },
  selectedTokens: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, minHeight: 46, padding: ds.spacing.xs, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt },
  selectedToken: { paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs, borderRadius: ds.radius.sm, backgroundColor: ds.colors.infoSoft },
  selectedTokenText: { color: ds.colors.primary, fontWeight: '900' },
  tokenPool: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  token: { paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.sm, borderRadius: ds.radius.sm, backgroundColor: ds.colors.surface, borderWidth: 1, borderColor: ds.colors.border },
  tokenText: { color: ds.colors.text, fontWeight: '800' },
  fillSection: { marginTop: ds.spacing.md, gap: ds.spacing.sm },
  fillSentence: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  fillInput: { minHeight: ds.touch.min, borderWidth: 1, borderColor: ds.colors.border, borderRadius: ds.radius.md, paddingHorizontal: ds.spacing.md, fontSize: ds.type.body, color: ds.colors.text, backgroundColor: ds.colors.surfaceAlt },
  fillHint: { fontSize: ds.type.caption, color: ds.colors.textMuted },
  resultCard: { padding: ds.spacing.lg, gap: ds.spacing.xs },
  resultTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.warmInkStrong },
  resultScore: { fontSize: ds.type.display, fontWeight: '900', color: ds.colors.warmInkStrong },
  resultSummary: { fontSize: ds.type.caption, color: ds.colors.warmInkStrong, fontWeight: '900', marginTop: ds.spacing.xs },
  breakdownList: { gap: ds.spacing.xs, marginTop: ds.spacing.xs },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: ds.spacing.sm },
  breakdownLabel: { flex: 1, fontSize: ds.type.caption, color: ds.colors.warmInkStrong },
  breakdownScore: { fontSize: ds.type.caption, color: ds.colors.warmInkStrong, fontWeight: '900' },
  divider: { height: 1, backgroundColor: 'rgba(124,45,18,0.2)', marginVertical: ds.spacing.sm },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.xs, marginTop: ds.spacing.xs },
  feedbackIcon: { fontSize: 16 },
  feedbackText: { flex: 1, fontSize: ds.type.body, color: ds.colors.warmInkStrong, flexShrink: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1, paddingHorizontal: ds.spacing.lg },
});
