import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { getExampleSentencesForApp } from '../data/candidates/exampleSentenceCandidatePack';
import { track } from '../services/analyticsService';
import { useLearningContext } from '../services/learningContext';
import { useUserProfileContext } from '../services/userProfileContext';
import {
  buildSentenceLabSession,
  getMistakeNotebookEntries,
  isSentenceLabEligible,
  isCorrectSentenceOrder,
  recordSentenceLabResult,
  type MistakeNotebookEntry,
  type SentenceBuilderToken,
  type SentenceLabExercise,
} from '../services/sentenceLabService';
import { speakJapanese } from '../services/speechPracticeService';
import { ds } from '../theme/designSystem';

type LabMode = 'mixed' | 'mistakes';

export function SentenceLabScreen() {
  const all = useMemo(() => getExampleSentencesForApp().filter(isSentenceLabEligible), []);
  const byId = useMemo(() => new Map(all.map(sentence => [sentence.id, sentence])), [all]);
  const { ready, srs, store: practiceStore } = useLearningContext();
  const { profile } = useUserProfileContext();
  const [mode, setMode] = useState<LabMode>('mixed');
  const [notebook, setNotebook] = useState<MistakeNotebookEntry[]>([]);
  const [session, setSession] = useState<SentenceLabExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<SentenceBuilderToken[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const reloadRequestRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const reload = useCallback(async (nextMode: LabMode = mode) => {
    if (!srs) return;
    const requestId = ++reloadRequestRef.current;
    setLoadError(null);
    try {
      const cards = await srs.listCards();
      if (!mountedRef.current || requestId !== reloadRequestRef.current) return;
      const entries = getMistakeNotebookEntries(cards, all);
      const sourceCards = nextMode === 'mistakes' ? entries.map(entry => entry.card) : cards;
      const exerciseCount = nextMode === 'mistakes' ? Math.min(10, entries.length) : 10;
      setNotebook(entries);
      setSession(buildSentenceLabSession(all, sourceCards, exerciseCount));
      setIndex(0);
      setSelectedTokens([]);
      setFeedback(null);
      setActionError(null);
    } catch (error) {
      if (!mountedRef.current || requestId !== reloadRequestRef.current) return;
      if (__DEV__) console.warn('[sentence-lab] failed to load session', error);
      setLoadError('We could not load Sentence Lab right now. Please try again.');
      setSession([]);
      setSelectedTokens([]);
      setFeedback(null);
    }
  }, [all, mode, srs]);

  useEffect(() => {
    if (!ready || !srs) return;
    void reload(mode);
  }, [mode, ready, reload, srs]);

  const exercise = session[index];
  const sentence = exercise ? byId.get(exercise.sentenceId) : undefined;
  const availableTokens = exercise?.tokens?.filter(
    token => !selectedTokens.some(selected => selected.id === token.id),
  ) ?? [];

  async function submit(correct: boolean) {
    if (!sentence || !srs || feedback || saving) return;
    setSaving(true);
    setActionError(null);
    let reviewSaved = false;
    try {
      await recordSentenceLabResult(srs, sentence.id, correct);
      reviewSaved = true;
      await practiceStore?.recordSentenceLabReview(
        sentence.id,
        undefined,
        profile?.dynamic.placement?.level,
      );
      await practiceStore?.recordMasteryEvidence({
        refId: `sentence-lab:${sentence.id}`,
        modality: 'listening',
        score: correct ? 1 : 0,
        source: 'sentence-lab',
      });
      await practiceStore?.recordMasteryEvidence({
        refId: `sentence-lab:${sentence.id}`,
        modality: 'production',
        score: correct ? 0.85 : 0,
        source: 'sentence-lab',
      });
      if (!mountedRef.current) return;
      setFeedback(correct ? 'correct' : 'wrong');
      track('sentence_lab_answered', { kind: exercise.kind, correct, mode });
      try {
        const cards = await srs.listCards();
        if (mountedRef.current) setNotebook(getMistakeNotebookEntries(cards, all));
      } catch (refreshError) {
        if (__DEV__) console.warn('[sentence-lab] saved answer but failed to refresh notebook', refreshError);
      }
    } catch (error) {
      if (__DEV__) console.warn('[sentence-lab] failed to save answer', error);
      if (!mountedRef.current) return;
      if (reviewSaved) {
        setFeedback(correct ? 'correct' : 'wrong');
        setActionError('Your answer was saved, but progress details could not refresh.');
      } else {
        setActionError('We could not save that answer. Please try again.');
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  function continueSession() {
    if (index + 1 >= session.length) {
      void reload(mode);
      return;
    }
    setIndex(value => value + 1);
    setSelectedTokens([]);
    setFeedback(null);
    setActionError(null);
  }

  if (!ready || !srs) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Listening & Sentence Lab</Text>
        <Text style={styles.subtitle}>Preparing your adaptive practice…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Listening & Sentence Lab</Text>
      <Text style={styles.subtitle}>Listen, rebuild sentences, and automatically revisit mistakes.</Text>

      <View style={styles.modeRow}>
        <Chip label="Mixed practice" selected={mode === 'mixed'} onPress={() => setMode('mixed')} />
        <Chip
          label={`Mistakes (${notebook.length})`}
          selected={mode === 'mistakes'}
          onPress={() => setMode('mistakes')}
        />
      </View>

      {loadError ? (
        <Card shadow="card">
          <Text style={styles.errorText} accessibilityRole="alert">{loadError}</Text>
          <Button label="Retry" onPress={() => void reload(mode)} style={styles.topGap} />
        </Card>
      ) : null}

      {mode === 'mistakes' && notebook.length === 0 ? (
        <Card shadow="card">
          <View style={styles.emptyArt}><EmptyStateArt screen="lessons" size={150} /></View>
          <Text style={styles.emptyTitle}>No saved mistakes</Text>
          <Text style={styles.emptyCopy}>Missed listening or sentence exercises will appear here automatically.</Text>
          <Button label="Start mixed practice" onPress={() => setMode('mixed')} style={styles.topGap} />
        </Card>
      ) : !loadError && session.length === 0 ? (
        <Card shadow="card">
          <Text style={styles.emptyTitle}>Sentence Lab is unavailable</Text>
          <Text style={styles.emptyCopy}>There are not enough reviewed sentences with audio and word-order data yet.</Text>
          <Button label="Retry" onPress={() => void reload(mode)} style={styles.topGap} />
        </Card>
      ) : sentence && exercise ? (
        <>
          <View style={styles.progressRow}>
            <Text style={styles.progress}>Question {index + 1} of {session.length}</Text>
            <Badge label={exercise.kind === 'listening' ? 'Listening' : 'Sentence builder'} tone="brand" />
          </View>

          <Card shadow="hero">
            {exercise.kind === 'listening' ? (
              <>
                <Text style={styles.prompt}>Listen without looking at the Japanese. What does it mean?</Text>
                <Button
                  label="Play Japanese audio"
                  icon="play"
                  onPress={() => speakJapanese(sentence.japanese, 0.78)}
                  testID="sentence-lab-play-audio"
                />
                <Button
                  label="Play slowly"
                  icon="play"
                  variant="soft"
                  onPress={() => speakJapanese(sentence.japanese, 0.62)}
                  style={styles.smallGap}
                />
                <View style={styles.choiceList}>
                  {exercise.choices?.map((choice, choiceIndex) => {
                    const correct = choiceIndex === exercise.correctChoiceIndex;
                    const selectedStyle = feedback
                      ? correct ? styles.correctChoice : styles.dimmedChoice
                      : undefined;
                    return (
                      <Pressable
                        key={`${choice.sentenceId}-${choiceIndex}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Answer: ${choice.text}`}
                        accessibilityState={{ disabled: feedback != null }}
                        disabled={feedback != null}
                        onPress={() => void submit(correct)}
                        style={({ pressed }) => [styles.choice, selectedStyle, pressed && !feedback ? styles.pressed : undefined]}
                      >
                        <Text style={styles.choiceText}>{choice.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.prompt}>Put the romaji words in the correct order.</Text>
                <Text style={styles.meaning}>{sentence.english}</Text>
                <View style={styles.answerTray}>
                  {selectedTokens.length === 0 ? <Text style={styles.trayHint}>Tap words below</Text> : null}
                  {selectedTokens.map(token => (
                    <Pressable
                      key={token.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${token.text}`}
                      accessibilityState={{ disabled: feedback != null }}
                      onPress={() => !feedback && setSelectedTokens(current => current.filter(item => item.id !== token.id))}
                      style={styles.selectedToken}
                    >
                      <Text style={styles.selectedTokenText}>{token.text}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.tokenPool}>
                  {availableTokens.map(token => (
                    <Pressable
                      key={token.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedTokens(current => [...current, token])}
                      disabled={feedback != null}
                      style={styles.token}
                    >
                      <Text style={styles.tokenText}>{token.text}</Text>
                    </Pressable>
                  ))}
                </View>
                {!feedback ? (
                  <Button
                    label="Check sentence"
                    onPress={() => void submit(isCorrectSentenceOrder(selectedTokens, exercise.tokens?.length ?? 0))}
                    disabled={selectedTokens.length !== (exercise.tokens?.length ?? 0)}
                    style={styles.topGap}
                    testID="sentence-lab-check-order"
                  />
                ) : null}
              </>
            )}

            {feedback ? (
              <View style={[styles.feedback, feedback === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong]}>
                <Text style={styles.feedbackTitle}>{feedback === 'correct' ? 'Correct!' : 'Added to your Mistake Notebook'}</Text>
                <Text style={styles.japanese}>{sentence.japanese}</Text>
                <Text style={styles.romaji}>{sentence.romaji}</Text>
                <Text style={styles.explanation}>{sentence.english}</Text>
                <Button
                  label={index + 1 >= session.length ? 'Start another session' : 'Continue'}
                  onPress={continueSession}
                  disabled={saving}
                  style={styles.topGap}
                />
              </View>
            ) : null}
            {actionError ? <Text style={styles.errorText} accessibilityRole="alert">{actionError}</Text> : null}
          </Card>

          <Card shadow="none">
            <Text style={styles.notebookTitle}>Mistake Notebook</Text>
            <Text style={styles.notebookCopy}>
              {notebook.filter(entry => entry.due).length} due now · {notebook.length} saved. Correct reviews are spaced farther apart automatically.
            </Text>
          </Card>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: ds.spacing.md },
  title: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text },
  subtitle: { fontSize: ds.type.body, color: ds.colors.textMuted, lineHeight: 22, marginTop: ds.spacing.xs },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginVertical: ds.spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: ds.spacing.sm },
  progress: { fontSize: ds.type.caption, color: ds.colors.textMuted, fontWeight: '800' },
  prompt: { fontSize: ds.type.heading, color: ds.colors.text, fontWeight: '900', lineHeight: 25, marginBottom: ds.spacing.md },
  meaning: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800', marginBottom: ds.spacing.md },
  smallGap: { marginTop: ds.spacing.xs },
  topGap: { marginTop: ds.spacing.md },
  choiceList: { gap: ds.spacing.sm, marginTop: ds.spacing.md },
  choice: { minHeight: ds.touch.comfortable, justifyContent: 'center', borderWidth: 1, borderColor: ds.colors.border, borderRadius: ds.radius.md, padding: ds.spacing.md, backgroundColor: ds.colors.surface },
  choiceText: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '700' },
  correctChoice: { backgroundColor: ds.colors.successSoft, borderColor: ds.colors.success },
  dimmedChoice: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  answerTray: { minHeight: 86, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', gap: ds.spacing.xs, borderWidth: 1, borderColor: ds.colors.border, borderRadius: ds.radius.md, padding: ds.spacing.sm, backgroundColor: ds.colors.surfaceAlt },
  trayHint: { color: ds.colors.textMuted, fontSize: ds.type.body, alignSelf: 'center' },
  tokenPool: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginTop: ds.spacing.md },
  token: { minHeight: ds.touch.min, justifyContent: 'center', paddingHorizontal: ds.spacing.md, borderRadius: ds.radius.pill, backgroundColor: ds.colors.brandSoft },
  tokenText: { color: ds.colors.brandDark, fontSize: ds.type.body, fontWeight: '800' },
  selectedToken: { minHeight: 38, justifyContent: 'center', paddingHorizontal: ds.spacing.sm, borderRadius: ds.radius.sm, backgroundColor: ds.colors.surface },
  selectedTokenText: { color: ds.colors.text, fontSize: ds.type.body, fontWeight: '800' },
  feedback: { marginTop: ds.spacing.md, borderRadius: ds.radius.md, padding: ds.spacing.md },
  feedbackCorrect: { backgroundColor: ds.colors.successSoft },
  feedbackWrong: { backgroundColor: ds.colors.dangerSoft },
  feedbackTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  japanese: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.sm },
  romaji: { fontSize: ds.type.body, fontWeight: '800', color: ds.colors.primary, marginTop: ds.spacing.xs },
  explanation: { fontSize: ds.type.body, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  notebookTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  notebookCopy: { fontSize: ds.type.body, color: ds.colors.textMuted, lineHeight: 22, marginTop: ds.spacing.xs },
  errorText: { fontSize: ds.type.body, color: ds.colors.danger, lineHeight: 22, fontWeight: '700' },
  emptyArt: { alignItems: 'center' },
  emptyTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyCopy: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', lineHeight: 22, marginTop: ds.spacing.xs },
});
