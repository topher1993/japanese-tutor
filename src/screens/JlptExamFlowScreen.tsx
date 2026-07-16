import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { Button } from '../components/Button';
import { Card, CardSubtitle, CardTitle } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { getJlptExamBlueprint, getJlptSectionQuestionCount } from '../data/jlptExamBlueprints';
import type { JlptExamAttemptRepository } from '../repositories/jlptExamAttemptRepository';
import { assembleJlptExam } from '../services/jlptExamAssembler';
import {
  type JlptExamTelemetry,
  type JlptExamTelemetryEvent,
  trackJlptExamEvent,
} from '../services/jlptExamAnalyticsService';
import { scoreJlptExamAttempt } from '../services/jlptExamScoringService';
import {
  abandonJlptExam,
  answerJlptQuestion,
  continueJlptExam,
  createJlptExamAttempt,
  getCurrentJlptQuestion,
  getCurrentJlptSection,
  getJlptRemainingSeconds,
  navigateJlptQuestion,
  pauseJlptExam,
  reconcileJlptExamDeadline,
  recordJlptAudioPlayback,
  resumeJlptExam,
  submitCurrentJlptSection,
  toggleJlptQuestionFlag,
} from '../services/jlptExamSessionService';
import { speakJapanese } from '../services/speechPracticeService';
import { ds } from '../theme/designSystem';
import {
  JLPT_UNOFFICIAL_NOTICE,
  type JlptChoiceId,
  type JlptExamAttempt,
  type JlptExamMode,
  type JlptExamQuestion,
  type JlptExamResult,
  type JlptLevel,
  type JlptTimerPolicy,
} from '../types/jlptExam';

type FlowView = 'loading' | 'setup' | 'instructions' | 'exam' | 'results';

export interface JlptExamFlowScreenProps {
  repository: JlptExamAttemptRepository;
  onExit: () => void;
  /** Override this for tests or a host-level analytics adapter. No question content is emitted. */
  onTelemetry?: (event: JlptExamTelemetryEvent, payload: JlptExamTelemetry) => void;
  /** Override this when recorded audio becomes available. The default uses Japanese TTS. */
  onPlayAudio?: (text: string, question: JlptExamQuestion) => void | Promise<void>;
}

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3'];
const MODES: JlptExamMode[] = ['mini', 'full'];
const TIMER_POLICIES: JlptTimerPolicy[] = ['strict', 'practice'];
const ANNOUNCEMENT_THRESHOLDS = [300, 60, 30, 10];

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function modeLabel(mode: JlptExamMode): string {
  return mode === 'mini' ? 'Mini mock' : 'Full mock';
}

function policyLabel(policy: JlptTimerPolicy): string {
  return policy === 'strict' ? 'Strict timer' : 'Practice timer';
}

function questionCount(attempt: JlptExamAttempt): number {
  return attempt.sections.reduce((total, section) => total + section.questions.length, 0);
}

function answeredCount(attempt: JlptExamAttempt): number {
  return Object.keys(attempt.answers).length;
}

function ChoiceOption({
  id,
  text,
  selected,
  onPress,
}: {
  id: JlptChoiceId;
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Choice ${id}: ${text}`}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      testID={`jlpt-choice-${id.toLowerCase()}`}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.choiceLetter, selected && styles.choiceLetterSelected]}>
        <Text style={[styles.choiceLetterText, selected && styles.choiceLetterTextSelected]}>{id}</Text>
      </View>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{text}</Text>
    </Pressable>
  );
}

function QuestionPalette({
  attempt,
  onSelect,
}: {
  attempt: JlptExamAttempt;
  onSelect: (index: number) => void;
}) {
  const section = getCurrentJlptSection(attempt);
  if (!section) return null;
  return (
    <Card tone="soft" shadow="none">
      <CardTitle>Question palette</CardTitle>
      <CardSubtitle>Answered questions are filled. A dot marks questions flagged for review.</CardSubtitle>
      <View accessibilityRole="radiogroup" style={styles.palette}>
        {section.questions.map((question, index) => {
          const current = index === attempt.currentQuestionIndex;
          const answered = attempt.answers[question.id] !== undefined;
          const flagged = attempt.flaggedQuestionIds.includes(question.id);
          return (
            <Pressable
              key={question.id}
              accessibilityRole="radio"
              accessibilityLabel={`Question ${index + 1}, ${answered ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}`}
              accessibilityState={{ checked: current, selected: current }}
              aria-checked={current}
              onPress={() => onSelect(index)}
              style={({ pressed }) => [
                styles.paletteItem,
                answered && styles.paletteAnswered,
                current && styles.paletteCurrent,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.paletteText, answered && styles.paletteTextAnswered]}>{index + 1}</Text>
              {flagged ? <View accessibilityElementsHidden style={styles.flagDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export function JlptExamFlowScreen({
  repository,
  onExit,
  onTelemetry,
  onPlayAudio,
}: JlptExamFlowScreenProps) {
  const [view, setView] = useState<FlowView>('loading');
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [mode, setMode] = useState<JlptExamMode>('mini');
  const [timerPolicy, setTimerPolicy] = useState<JlptTimerPolicy>('practice');
  const [attempt, setAttempt] = useState<JlptExamAttempt | null>(null);
  const [result, setResult] = useState<JlptExamResult | null>(null);
  const [history, setHistory] = useState<JlptExamResult[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showReplaceConfirmation, setShowReplaceConfirmation] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const attemptRef = useRef<JlptExamAttempt | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveFailedRef = useRef(false);
  const finalizedAttemptIdsRef = useRef(new Set<string>());
  const announcedThresholdsRef = useRef(new Set<string>());

  const emit = useCallback((event: JlptExamTelemetryEvent, payload: JlptExamTelemetry) => {
    try {
      (onTelemetry ?? trackJlptExamEvent)(event, payload);
    } catch {
      // Telemetry must never interrupt an exam.
    }
  }, [onTelemetry]);

  const queueSave = useCallback((next: JlptExamAttempt) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => repository.saveActiveAttempt(next))
      .then(() => {
        saveFailedRef.current = false;
        setPersistenceError(null);
      })
      .catch(() => {
        saveFailedRef.current = true;
        setPersistenceError('Your latest answer could not be saved. Keep this screen open and try again.');
      });
    return saveQueueRef.current;
  }, [repository]);

  const commitAttempt = useCallback((next: JlptExamAttempt, previous?: JlptExamAttempt | null) => {
    const prior = previous ?? attemptRef.current;
    attemptRef.current = next;
    setAttempt(next);
    void queueSave(next);

    if (prior && next.sectionSubmissions.length > prior.sectionSubmissions.length) {
      const submission = next.sectionSubmissions[next.sectionSubmissions.length - 1];
      const section = prior.sections[prior.currentSectionIndex];
      if (submission && section) {
        emit('section_submitted', {
          level: prior.level,
          mode: prior.mode,
          timerPolicy: prior.timerPolicy,
          section: section.id,
          questionCount: section.questions.length,
          answeredCount: section.questions.filter(question => prior.answers[question.id] !== undefined).length,
          durationSeconds: submission.elapsedSeconds,
          completionReason: submission.reason,
        });
      }
    }
  }, [emit, queueSave]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([repository.loadActiveAttempt(), repository.listResults()])
      .then(async ([storedAttempt, storedHistory]) => {
        if (cancelled) return;
        setHistory(storedHistory);
        if (!storedAttempt || storedAttempt.status === 'abandoned') {
          if (storedAttempt?.status === 'abandoned') await repository.clearActiveAttempt();
          setView('setup');
          return;
        }

        let restored = storedAttempt;
        if (storedAttempt.status === 'active') {
          restored = storedAttempt.timerPolicy === 'practice'
            ? pauseJlptExam(storedAttempt, storedAttempt.updatedAt)
            : reconcileJlptExamDeadline(storedAttempt, Date.now());
        }
        attemptRef.current = restored;
        setAttempt(restored);
        setLevel(restored.level);
        setMode(restored.mode);
        setTimerPolicy(restored.timerPolicy);
        if (restored !== storedAttempt) void queueSave(restored);
        if (restored.status === 'completed') {
          setResult(scoreJlptExamAttempt(restored));
          setView('results');
        } else {
          setView('setup');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersistenceError('Saved JLPT practice could not be loaded. You can still start a new mock.');
          setView('setup');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [queueSave, repository]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'completed') return;
    const completed = attempt;
    const scored = scoreJlptExamAttempt(completed);
    setResult(scored);
    setView('results');
    if (finalizedAttemptIdsRef.current.has(completed.id)) return;
    finalizedAttemptIdsRef.current.add(completed.id);

    void (async () => {
      try {
        await saveQueueRef.current;
        await repository.addResult(scored);
        await repository.clearActiveAttempt();
        const latestHistory = await repository.listResults();
        setHistory(latestHistory);
        setPersistenceError(null);
        emit('completed', {
          level: completed.level,
          mode: completed.mode,
          timerPolicy: completed.timerPolicy,
          questionCount: questionCount(completed),
          answeredCount: answeredCount(completed),
          durationSeconds: completed.sectionSubmissions.reduce((total, submission) => total + submission.elapsedSeconds, 0),
        });
      } catch {
        finalizedAttemptIdsRef.current.delete(completed.id);
        setPersistenceError('Your result is ready, but it could not be added to history yet. It will retry next time.');
      }
    })();
  }, [attempt, emit, repository]);

  useEffect(() => {
    if (view !== 'exam' || attempt?.status !== 'active') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempt?.status, view]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'active') return;
    const reconciled = reconcileJlptExamDeadline(attempt, now);
    if (reconciled !== attempt) {
      setShowSubmitConfirmation(false);
      commitAttempt(reconciled, attempt);
      if (reconciled.status === 'completed') setView('results');
    }
  }, [attempt, commitAttempt, now]);

  const remainingSeconds = attempt?.status === 'active' ? getJlptRemainingSeconds(attempt, now) : 0;

  useEffect(() => {
    if (!attempt || attempt.status !== 'active') return;
    const section = getCurrentJlptSection(attempt);
    if (!section) return;
    const crossed = ANNOUNCEMENT_THRESHOLDS.filter(threshold => remainingSeconds <= threshold && remainingSeconds > 0);
    const hasUnannouncedThreshold = crossed.some(threshold =>
      !announcedThresholdsRef.current.has(`${attempt.id}:${section.id}:${threshold}`));
    if (hasUnannouncedThreshold) {
      // If the app resumes below several thresholds, announce once and mark
      // the larger thresholds as crossed instead of speaking every second.
      crossed.forEach(threshold => announcedThresholdsRef.current.add(`${attempt.id}:${section.id}:${threshold}`));
      AccessibilityInfo.announceForAccessibility(`${formatDuration(remainingSeconds)} remaining in ${section.label}.`);
    }
  }, [attempt, remainingSeconds]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      const current = attemptRef.current;
      if (!current) return;

      const leavingForeground = previousState === 'active' && nextState !== 'active';
      const returningToForeground = previousState !== 'active' && nextState === 'active';
      if (leavingForeground && current.status === 'active') {
        if (current.timerPolicy === 'practice') {
          commitAttempt(pauseJlptExam(current, Date.now()), current);
        } else {
          void queueSave(current);
        }
      } else if (returningToForeground) {
        const latest = attemptRef.current;
        if (!latest) return;
        // A saved practice attempt stays paused on setup until the learner
        // explicitly taps Resume. Only a visible exam resumes automatically.
        if (latest.status === 'paused' && view !== 'exam') return;
        const next = latest.status === 'paused'
          ? resumeJlptExam(latest, Date.now())
          : reconcileJlptExamDeadline(latest, Date.now());
        if (next !== latest) commitAttempt(next, latest);
        setNow(Date.now());
      }
    });
    return () => subscription.remove();
  }, [commitAttempt, queueSave, view]);

  const blueprint = useMemo(() => getJlptExamBlueprint(level), [level]);
  const blueprintTotal = useMemo(() => blueprint.sections.reduce(
    (total, section) => total + getJlptSectionQuestionCount(section, mode),
    0,
  ), [blueprint, mode]);
  const blueprintDuration = useMemo(() => blueprint.sections.reduce(
    (total, section) => total + (mode === 'mini' ? section.miniDurationSeconds : section.fullDurationSeconds),
    0,
  ), [blueprint, mode]);

  const hasResumableAttempt = Boolean(attempt && ['active', 'paused', 'section-break'].includes(attempt.status));

  const startInstructions = () => {
    setScreenError(null);
    if (hasResumableAttempt) {
      setShowReplaceConfirmation(true);
      return;
    }
    setView('instructions');
  };

  const abandonStoredAttempt = async (exitAfter: boolean) => {
    const current = attemptRef.current;
    if (current && current.status !== 'completed') {
      const abandoned = abandonJlptExam(current, Date.now());
      emit('abandoned', {
        level: current.level,
        mode: current.mode,
        timerPolicy: current.timerPolicy,
        questionCount: questionCount(current),
        answeredCount: answeredCount(current),
        durationSeconds: Math.max(0, Math.round((Date.now() - current.startedAt) / 1000)),
        completionReason: 'exit',
      });
      attemptRef.current = abandoned;
      setAttempt(null);
      try {
        await saveQueueRef.current;
        await repository.clearActiveAttempt();
        setPersistenceError(null);
      } catch {
        setPersistenceError('The saved attempt could not be removed.');
      }
    }
    setShowExitConfirmation(false);
    setShowReplaceConfirmation(false);
    if (exitAfter) onExit();
    else setView('instructions');
  };

  const beginExam = () => {
    try {
      const exam = assembleJlptExam(level, mode, Date.now());
      const next = createJlptExamAttempt(exam, timerPolicy, Date.now());
      setResult(null);
      setAudioError(null);
      setShowPalette(false);
      setNow(Date.now());
      commitAttempt(next, null);
      setView('exam');
      emit('started', {
        level,
        mode,
        timerPolicy,
        questionCount: questionCount(next),
      });
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : 'This mock could not be assembled.');
    }
  };

  const resumeAttempt = () => {
    const current = attemptRef.current;
    if (!current) return;
    let next = current;
    if (current.status === 'paused') next = resumeJlptExam(current, Date.now());
    else if (current.status === 'active') next = reconcileJlptExamDeadline(current, Date.now());
    if (next !== current) commitAttempt(next, current);
    setLevel(next.level);
    setMode(next.mode);
    setTimerPolicy(next.timerPolicy);
    setNow(Date.now());
    setView(next.status === 'completed' ? 'results' : 'exam');
    emit('resumed', {
      level: next.level,
      mode: next.mode,
      timerPolicy: next.timerPolicy,
      section: next.sections[next.currentSectionIndex]?.id,
      questionCount: questionCount(next),
      answeredCount: answeredCount(next),
    });
  };

  const requestExit = () => {
    if (view === 'setup' || view === 'loading' || view === 'results') {
      onExit();
      return;
    }
    if (view === 'instructions' && !hasResumableAttempt) {
      setView('setup');
      return;
    }
    setShowExitConfirmation(true);
  };

  const saveAndExit = async () => {
    const current = attemptRef.current;
    if (current) {
      const saved = current.timerPolicy === 'practice' && current.status === 'active'
        ? pauseJlptExam(current, Date.now())
        : current;
      if (saved !== current) commitAttempt(saved, current);
      else void queueSave(saved);
      await saveQueueRef.current;
      if (saveFailedRef.current) {
        setShowExitConfirmation(false);
        return;
      }
    }
    setShowExitConfirmation(false);
    onExit();
  };

  const answerChoice = (choice: JlptChoiceId) => {
    const current = attemptRef.current;
    const question = current ? getCurrentJlptQuestion(current) : undefined;
    if (!current || !question) return;
    commitAttempt(answerJlptQuestion(current, question.id, choice, Date.now()), current);
  };

  const toggleFlag = () => {
    const current = attemptRef.current;
    const question = current ? getCurrentJlptQuestion(current) : undefined;
    if (!current || !question) return;
    commitAttempt(toggleJlptQuestionFlag(current, question.id, Date.now()), current);
  };

  const navigate = (index: number) => {
    const current = attemptRef.current;
    if (!current) return;
    setAudioError(null);
    commitAttempt(navigateJlptQuestion(current, index, Date.now()), current);
  };

  const submitSection = () => {
    const current = attemptRef.current;
    if (!current) return;
    const next = submitCurrentJlptSection(current, 'submitted', Date.now());
    setShowSubmitConfirmation(false);
    setShowPalette(false);
    commitAttempt(next, current);
    if (next.status === 'completed') setView('results');
  };

  const continueToNextSection = () => {
    const current = attemptRef.current;
    if (!current) return;
    const next = continueJlptExam(current, Date.now());
    setAudioError(null);
    setNow(Date.now());
    commitAttempt(next, current);
  };

  const playAudio = async () => {
    const current = attemptRef.current;
    const question = current ? getCurrentJlptQuestion(current) : undefined;
    const audioText = question?.stimulus?.kind === 'audio' ? question.stimulus.audioText : undefined;
    if (!current || !question || !audioText || audioBusy) return;
    const priorPlays = current.audioPlayback[question.id]?.plays ?? 0;
    if (question.audioPlayLimit !== undefined && priorPlays >= question.audioPlayLimit) return;

    setAudioBusy(true);
    setAudioError(null);
    try {
      await Promise.resolve(onPlayAudio ? onPlayAudio(audioText, question) : speakJapanese(audioText));
      const latest = attemptRef.current;
      if (!latest) return;
      const started = recordJlptAudioPlayback(latest, question.id, 'started', Date.now());
      const completed = recordJlptAudioPlayback(started, question.id, 'completed', Date.now());
      commitAttempt(completed, latest);
    } catch {
      const latest = attemptRef.current;
      if (latest) {
        const failed = recordJlptAudioPlayback(latest, question.id, 'failed', Date.now());
        commitAttempt(failed, latest);
      }
      setAudioError('Audio could not start. You may retry; a failed start does not use your one play.');
      emit('audio_failed', {
        level: current.level,
        mode: current.mode,
        timerPolicy: current.timerPolicy,
        section: question.section,
        errorCode: 'playback-failed',
      });
    } finally {
      setAudioBusy(false);
    }
  };

  if (view === 'loading') {
    return (
      <ScreenScaffold>
        <ScreenHeader title="JLPT-style mock" onBack={onExit} />
        <Card tone="soft"><CardTitle>Loading saved practice…</CardTitle></Card>
      </ScreenScaffold>
    );
  }

  if (view === 'setup') {
    return (
      <ScreenScaffold>
        <ScreenHeader title="JLPT-style mock" subtitle="Choose a level and practice format" onBack={onExit} />
        {persistenceError ? <Text accessibilityRole="alert" style={styles.errorText}>{persistenceError}</Text> : null}

        {hasResumableAttempt && attempt ? (
          <Card tone="warm">
            <CardTitle>Saved mock in progress</CardTitle>
            <CardSubtitle>
              {attempt.level} · {modeLabel(attempt.mode)} · {policyLabel(attempt.timerPolicy)} · {answeredCount(attempt)}/{questionCount(attempt)} answered
            </CardSubtitle>
            <Button label={attempt.status === 'section-break' ? 'Continue from section break' : 'Resume saved mock'} onPress={resumeAttempt} style={styles.cardButton} />
          </Card>
        ) : null}

        <Card>
          <CardTitle>Level</CardTitle>
          <CardSubtitle>Start with N5 if this is your first timed mock.</CardSubtitle>
          <View style={styles.chipRow}>
            {LEVELS.map(value => <Chip key={value} label={value} selected={level === value} onPress={() => setLevel(value)} />)}
          </View>
        </Card>

        <Card>
          <CardTitle>Length</CardTitle>
          <CardSubtitle>Mini mocks sample every official-style section. Full mocks use the complete app blueprint.</CardSubtitle>
          <View style={styles.chipRow}>
            {MODES.map(value => <Chip key={value} label={modeLabel(value)} selected={mode === value} onPress={() => setMode(value)} />)}
          </View>
        </Card>

        <Card>
          <CardTitle>Timer behavior</CardTitle>
          <CardSubtitle>
            Strict time continues in the background. Practice time pauses when the app is not active.
          </CardSubtitle>
          <View style={styles.chipRow}>
            {TIMER_POLICIES.map(value => <Chip key={value} label={policyLabel(value)} selected={timerPolicy === value} onPress={() => setTimerPolicy(value)} />)}
          </View>
        </Card>

        <Card tone="brand">
          <Text style={styles.brandEyebrow}>{level} {modeLabel(mode).toUpperCase()}</Text>
          <Text style={styles.brandMetric}>{blueprintTotal} questions · {Math.round(blueprintDuration / 60)} minutes</Text>
          <Text style={styles.brandBody}>Three sections: Vocabulary, Grammar / Reading, and Listening.</Text>
        </Card>

        {showReplaceConfirmation ? (
          <Card tone="danger">
            <CardTitle>Replace your saved mock?</CardTitle>
            <CardSubtitle>The saved attempt and its unanswered progress will be removed. Completed history is kept.</CardSubtitle>
            <View style={styles.buttonRow}>
              <Button label="Keep saved mock" variant="soft" fullWidth={false} onPress={() => setShowReplaceConfirmation(false)} style={styles.flexButton} />
              <Button label="Replace it" variant="danger" fullWidth={false} onPress={() => { void abandonStoredAttempt(false); }} style={styles.flexButton} />
            </View>
          </Card>
        ) : (
          <Button testID="jlpt-exam-start" label="Review instructions" onPress={startInstructions} />
        )}

        {history.length > 0 ? (
          <Card tone="soft">
            <CardTitle>Recent results</CardTitle>
            {history.slice(0, 3).map(entry => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.flexContent}>
                  <Text style={styles.historyTitle}>{entry.level} · {modeLabel(entry.mode)}</Text>
                  <Text style={styles.metaText}>{new Date(entry.completedAt).toLocaleDateString()} · {entry.correct}/{entry.total} correct</Text>
                </View>
                <Text accessibilityLabel={`${entry.accuracyPercent} percent`} style={styles.historyScore}>{entry.accuracyPercent}%</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Text style={styles.disclaimer}>{JLPT_UNOFFICIAL_NOTICE}</Text>
      </ScreenScaffold>
    );
  }

  if (view === 'instructions') {
    return (
      <ScreenScaffold>
        <ScreenHeader title={`${level} ${modeLabel(mode)}`} subtitle={`${policyLabel(timerPolicy)} · ${blueprintTotal} questions`} onBack={() => setView('setup')} />
        {screenError ? <Text accessibilityRole="alert" style={styles.errorText}>{screenError}</Text> : null}
        <Card tone="brand">
          <Text accessibilityRole="header" style={styles.brandMetric}>Before you begin</Text>
          <Text style={styles.brandBody}>Choose the best answer for every multiple-choice question. You can flag and revisit questions until that section is submitted.</Text>
        </Card>
        <Card>
          <CardTitle>Sections</CardTitle>
          {blueprint.sections.map((section, index) => {
            const duration = mode === 'mini' ? section.miniDurationSeconds : section.fullDurationSeconds;
            return (
              <View key={section.id} style={styles.instructionRow}>
                <Text style={styles.instructionIndex}>{index + 1}</Text>
                <View style={styles.flexContent}>
                  <Text style={styles.historyTitle}>{section.label}</Text>
                  <Text style={styles.metaText}>{getJlptSectionQuestionCount(section, mode)} questions · {Math.round(duration / 60)} minutes</Text>
                </View>
              </View>
            );
          })}
        </Card>
        <Card tone={timerPolicy === 'strict' ? 'warm' : 'info'}>
          <CardTitle>{policyLabel(timerPolicy)}</CardTitle>
          <CardSubtitle>
            {timerPolicy === 'strict'
              ? 'Time continues if you leave the app. An expired section is submitted automatically.'
              : 'Time pauses while the app is in the background. Active sections still submit automatically when their practice time reaches zero.'}
          </CardSubtitle>
        </Card>
        <Card tone="soft">
          <CardTitle>Listening rule</CardTitle>
          <CardSubtitle>Listening audio can be played once. If playback fails to start, you can safely retry without using that play.</CardSubtitle>
        </Card>
        <Card tone="soft">
          <CardTitle>About your result</CardTitle>
          <CardSubtitle>Results show raw accuracy and section strengths. They are not an official scaled JLPT score or pass prediction.</CardSubtitle>
        </Card>
        <Text style={styles.disclaimer}>{JLPT_UNOFFICIAL_NOTICE}</Text>
        <Button label="Begin mock" onPress={beginExam} />
      </ScreenScaffold>
    );
  }

  if (view === 'results' && result && attempt) {
    return (
      <ScreenScaffold>
        <ScreenHeader title={`${result.level} mock result`} subtitle={`${modeLabel(result.mode)} · ${policyLabel(result.timerPolicy)}`} onBack={onExit} />
        {persistenceError ? <Text accessibilityRole="alert" style={styles.errorText}>{persistenceError}</Text> : null}
        <Card tone="brand" style={styles.resultHero}>
          <Text accessibilityRole="header" style={styles.resultPercent}>{result.accuracyPercent}%</Text>
          <Text style={styles.brandMetric}>{result.correct} of {result.total} correct</Text>
          <Text style={styles.brandBody}>{result.unanswered} unanswered</Text>
        </Card>
        <Card>
          <CardTitle>Section breakdown</CardTitle>
          {result.bySection.map(section => (
            <View key={section.id} style={styles.resultRow}>
              <View style={styles.flexContent}>
                <Text style={styles.historyTitle}>{section.label}</Text>
                <Text style={styles.metaText}>{section.correct}/{section.total} correct · {section.unanswered} unanswered</Text>
              </View>
              <Text accessibilityLabel={`${section.accuracyPercent} percent`} style={styles.historyScore}>{section.accuracyPercent}%</Text>
            </View>
          ))}
        </Card>
        <Card>
          <CardTitle>Skill breakdown</CardTitle>
          {result.byScoringGroup.map(group => (
            <View key={group.id} style={styles.resultRow}>
              <View style={styles.flexContent}>
                <Text style={styles.historyTitle}>{group.label}</Text>
                <Text style={styles.metaText}>{group.correct}/{group.total} correct · {group.unanswered} unanswered</Text>
              </View>
              <Text accessibilityLabel={`${group.accuracyPercent} percent`} style={styles.historyScore}>{group.accuracyPercent}%</Text>
            </View>
          ))}
        </Card>
        <Card tone="soft">
          <CardTitle>Question-type breakdown</CardTitle>
          {result.byItemType.map(group => (
            <View key={group.id} style={styles.resultRow}>
              <View style={styles.flexContent}>
                <Text style={styles.historyTitle}>{group.label}</Text>
                <Text style={styles.metaText}>{group.correct}/{group.total} correct · {group.unanswered} unanswered</Text>
              </View>
              <Text accessibilityLabel={`${group.accuracyPercent} percent`} style={styles.breakdownPercent}>{group.accuracyPercent}%</Text>
            </View>
          ))}
        </Card>
        <Text style={styles.disclaimer}>{result.unofficialNotice}</Text>
        <Button label={showReview ? 'Hide answer review' : 'Review answers'} variant="soft" onPress={() => setShowReview(value => !value)} />
        {showReview ? attempt.sections.flatMap(section => section.questions).map((question, index) => {
          const questionResult = result.questionResults.find(entry => entry.questionId === question.id);
          const selected = questionResult?.selectedChoice;
          const selectedText = question.choices.find(choice => choice.id === selected)?.text;
          const correctText = question.choices.find(choice => choice.id === question.correctChoice)?.text;
          return (
            <Card key={question.id} tone={questionResult?.correct ? 'success' : 'danger'} shadow="none">
              <Text style={styles.reviewNumber}>Question {index + 1} · {question.itemType.replaceAll('-', ' ')}</Text>
              {question.stimulus?.transcript ? <Text style={styles.reviewTranscript}>Transcript: {question.stimulus.transcript}</Text> : null}
              <Text style={styles.reviewPrompt}>{question.prompt}</Text>
              <Text style={styles.reviewAnswer}>
                Your answer: {selected ? `${selected} — ${selectedText ?? ''}` : 'No answer'}{` · Correct: ${question.correctChoice} — ${correctText ?? ''}`}
              </Text>
              <Text style={styles.reviewExplanation}>{question.explanation}</Text>
            </Card>
          );
        }) : null}
        <Button label="Done" onPress={onExit} />
      </ScreenScaffold>
    );
  }

  const currentAttempt = attempt;
  const section = currentAttempt ? getCurrentJlptSection(currentAttempt) : undefined;
  const question = currentAttempt ? getCurrentJlptQuestion(currentAttempt) : undefined;

  if (!currentAttempt || !section) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="JLPT-style mock" onBack={requestExit} />
        <Card tone="danger"><CardTitle>This mock cannot continue.</CardTitle><CardSubtitle>Return to setup and start a new attempt.</CardSubtitle></Card>
        <Button label="Return to setup" onPress={() => setView('setup')} />
      </ScreenScaffold>
    );
  }

  if (currentAttempt.status === 'section-break') {
    const completedSection = currentAttempt.sections[currentAttempt.currentSectionIndex];
    const nextSection = currentAttempt.sections[currentAttempt.currentSectionIndex + 1];
    const submission = currentAttempt.sectionSubmissions[currentAttempt.sectionSubmissions.length - 1];
    const answered = completedSection.questions.filter(item => currentAttempt.answers[item.id] !== undefined).length;
    return (
      <ScreenScaffold>
        <ScreenHeader title="Section complete" subtitle={`${currentAttempt.level} ${modeLabel(currentAttempt.mode)}`} onBack={requestExit} />
        {persistenceError ? <Text accessibilityRole="alert" style={styles.errorText}>{persistenceError}</Text> : null}
        <Card tone="success">
          <CardTitle>{completedSection.label} submitted</CardTitle>
          <CardSubtitle>{answered}/{completedSection.questions.length} answered · {submission?.reason === 'timeout' ? 'Time expired' : 'Submitted by you'}</CardSubtitle>
        </Card>
        {nextSection ? (
          <Card>
            <CardTitle>Next: {nextSection.label}</CardTitle>
            <CardSubtitle>{nextSection.questions.length} questions · {Math.round(nextSection.durationSeconds / 60)} minutes. The timer starts when you continue.</CardSubtitle>
          </Card>
        ) : null}
        <Card tone="soft">
          <CardSubtitle>You cannot return to a submitted section. Take a short break before continuing.</CardSubtitle>
        </Card>
        <Button label="Start next section" onPress={continueToNextSection} />
        {showExitConfirmation ? (
          <Card tone="warm">
            <CardTitle>Leave this mock?</CardTitle>
            <CardSubtitle>Your section break is saved. You can resume later.</CardSubtitle>
            <View style={styles.buttonRow}>
              <Button label="Stay" variant="soft" fullWidth={false} onPress={() => setShowExitConfirmation(false)} style={styles.flexButton} />
              <Button label="Save and exit" fullWidth={false} onPress={() => { void saveAndExit(); }} style={styles.flexButton} />
            </View>
            <Button label="Abandon and exit" variant="danger" onPress={() => { void abandonStoredAttempt(true); }} style={styles.cardButton} />
          </Card>
        ) : null}
      </ScreenScaffold>
    );
  }

  if (!question || currentAttempt.status !== 'active') {
    return (
      <ScreenScaffold>
        <ScreenHeader title="JLPT-style mock" onBack={requestExit} />
        <Card tone="soft"><CardTitle>Restoring your mock…</CardTitle></Card>
      </ScreenScaffold>
    );
  }

  const selectedChoice = currentAttempt.answers[question.id];
  const flagged = currentAttempt.flaggedQuestionIds.includes(question.id);
  const sectionAnswered = section.questions.filter(item => currentAttempt.answers[item.id] !== undefined).length;
  const sectionUnanswered = section.questions.length - sectionAnswered;
  const sectionFlags = section.questions.filter(item => currentAttempt.flaggedQuestionIds.includes(item.id)).length;
  const playback = currentAttempt.audioPlayback[question.id];
  const audioLimitReached = question.audioPlayLimit !== undefined && (playback?.plays ?? 0) >= question.audioPlayLimit;
  const isLastQuestion = currentAttempt.currentQuestionIndex >= section.questions.length - 1;

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={section.label}
        subtitle={`${currentAttempt.level} ${modeLabel(currentAttempt.mode)} · Question ${currentAttempt.currentQuestionIndex + 1} of ${section.questions.length}`}
        onBack={requestExit}
      />
      {persistenceError ? <Text accessibilityRole="alert" style={styles.errorText}>{persistenceError}</Text> : null}
      <Card tone={remainingSeconds <= 60 ? 'danger' : 'soft'} shadow="none" style={styles.timerCard}>
        <View style={styles.timerRow}>
          <View style={styles.flexContent}>
            <Text style={styles.timerPolicy}>{policyLabel(currentAttempt.timerPolicy)}</Text>
            <Text style={styles.timerHint}>{currentAttempt.timerPolicy === 'strict' ? 'Continues in background' : 'Pauses in background'}</Text>
          </View>
          <Text
            accessible
            accessibilityLabel={`${formatDuration(remainingSeconds)} remaining`}
            testID="jlpt-exam-timer"
            style={[styles.timerValue, remainingSeconds <= 60 && styles.timerDanger]}
          >
            {formatDuration(remainingSeconds)}
          </Text>
        </View>
      </Card>

      <View style={styles.progressRow}>
        <Text style={styles.metaText}>{sectionAnswered}/{section.questions.length} answered</Text>
        <Button
          label={showPalette ? 'Hide palette' : 'Question palette'}
          variant="ghost"
          size="md"
          fullWidth={false}
          onPress={() => setShowPalette(value => !value)}
        />
      </View>

      {showPalette ? <QuestionPalette attempt={currentAttempt} onSelect={navigate} /> : null}

      <Card>
        <Text style={styles.itemType}>{question.itemType.replaceAll('-', ' ')}</Text>
        {question.stimulus?.kind === 'passage' || question.stimulus?.kind === 'notice' ? (
          <View accessibilityLabel={`${question.stimulus.kind}: ${question.stimulus.text ?? ''}`} style={styles.stimulus}>
            <Text accessibilityRole="header" style={styles.stimulusTitle}>{question.stimulus.title ?? (question.stimulus.kind === 'notice' ? 'Notice' : 'Passage')}</Text>
            <Text selectable style={styles.stimulusText}>{question.stimulus.text}</Text>
          </View>
        ) : null}
        {question.stimulus?.kind === 'audio' ? (
          <View style={styles.audioPanel}>
            {question.stimulus.title ? <Text style={styles.audioSource}>{question.stimulus.title}</Text> : null}
            <Text style={styles.audioRule}>Listen before choosing. This audio can be played once.</Text>
            <Button
              label={audioLimitReached ? 'Audio played' : audioBusy ? 'Starting audio…' : 'Play listening audio'}
              accessibilityLabel={audioLimitReached ? 'Listening audio already played; play limit reached' : 'Play listening audio once'}
              icon="play"
              variant="soft"
              disabled={audioBusy || audioLimitReached}
              onPress={() => { void playAudio(); }}
            />
            {audioError ? <Text accessibilityRole="alert" style={styles.errorText}>{audioError}</Text> : null}
          </View>
        ) : null}
        <Text accessibilityRole="header" style={styles.prompt}>{question.prompt}</Text>
        <View accessibilityRole="radiogroup" style={styles.choiceList}>
          {question.choices.map(choice => (
            <ChoiceOption
              key={choice.id}
              id={choice.id}
              text={choice.text}
              selected={selectedChoice === choice.id}
              onPress={() => answerChoice(choice.id)}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flagged ? 'Remove flag from this question' : 'Flag this question for review'}
          accessibilityState={{ selected: flagged }}
          aria-pressed={flagged}
          onPress={toggleFlag}
          style={({ pressed }) => [styles.flagButton, flagged && styles.flagButtonSelected, pressed && styles.pressed]}
        >
          <Text style={[styles.flagButtonText, flagged && styles.flagButtonTextSelected]}>{flagged ? '● Flagged for review' : '○ Flag for review'}</Text>
        </Pressable>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          label="Previous"
          variant="soft"
          fullWidth={false}
          disabled={currentAttempt.currentQuestionIndex === 0}
          onPress={() => navigate(currentAttempt.currentQuestionIndex - 1)}
          style={styles.flexButton}
        />
        <Button
          label={isLastQuestion ? 'Finish section' : 'Next'}
          fullWidth={false}
          onPress={() => isLastQuestion ? setShowSubmitConfirmation(true) : navigate(currentAttempt.currentQuestionIndex + 1)}
          style={styles.flexButton}
        />
      </View>

      {showSubmitConfirmation ? (
        <Card tone={sectionUnanswered > 0 ? 'warm' : 'info'}>
          <CardTitle>Submit {section.label}?</CardTitle>
          <CardSubtitle>{sectionUnanswered} unanswered · {sectionFlags} flagged. You cannot return after submitting.</CardSubtitle>
          <View style={styles.buttonRow}>
            <Button label="Keep reviewing" variant="soft" fullWidth={false} onPress={() => setShowSubmitConfirmation(false)} style={styles.flexButton} />
            <Button label="Submit section" fullWidth={false} onPress={submitSection} style={styles.flexButton} />
          </View>
        </Card>
      ) : null}

      {showExitConfirmation ? (
        <Card tone="warm">
          <CardTitle>Leave this mock?</CardTitle>
          <CardSubtitle>
            {currentAttempt.timerPolicy === 'strict'
              ? 'Your answers are saved, but the strict timer continues while you are away.'
              : 'Your answers and remaining practice time will be saved.'}
          </CardSubtitle>
          <View style={styles.buttonRow}>
            <Button label="Stay" variant="soft" fullWidth={false} onPress={() => setShowExitConfirmation(false)} style={styles.flexButton} />
            <Button label={currentAttempt.timerPolicy === 'strict' ? 'Save and exit (timer continues)' : 'Save and exit'} fullWidth={false} onPress={() => { void saveAndExit(); }} style={styles.flexButton} />
          </View>
          <Button label="Abandon and exit" variant="danger" onPress={() => { void abandonStoredAttempt(true); }} style={styles.cardButton} />
        </Card>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  audioPanel: { gap: ds.spacing.sm, marginBottom: ds.spacing.md },
  audioRule: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 19 },
  audioSource: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900' },
  brandBody: { color: ds.colors.brandInk, fontSize: ds.type.body, lineHeight: 22, marginTop: ds.spacing.sm },
  brandEyebrow: { color: ds.colors.brandInk, fontSize: ds.type.caption, fontWeight: '900', opacity: 0.84 },
  brandMetric: { color: ds.colors.brandInk, fontSize: ds.type.heading, fontWeight: '900', marginTop: ds.spacing.xs },
  breakdownPercent: { color: ds.colors.brandDark, fontSize: ds.type.body, fontWeight: '900' },
  buttonRow: { flexDirection: 'row', gap: ds.spacing.sm, alignItems: 'stretch' },
  cardButton: { marginTop: ds.spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, marginTop: ds.spacing.md },
  choice: {
    alignItems: 'center',
    backgroundColor: ds.colors.surface,
    borderColor: ds.colors.border,
    borderRadius: ds.radius.md,
    borderWidth: 2,
    flexDirection: 'row',
    gap: ds.spacing.md,
    minHeight: ds.touch.comfortable,
    padding: ds.spacing.md,
  },
  choiceLetter: {
    alignItems: 'center',
    backgroundColor: ds.colors.surfaceAlt,
    borderRadius: ds.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  choiceLetterSelected: { backgroundColor: ds.colors.brand },
  choiceLetterText: { color: ds.colors.textMuted, fontSize: ds.type.body, fontWeight: '900' },
  choiceLetterTextSelected: { color: ds.colors.brandInk },
  choiceList: { gap: ds.spacing.sm },
  choiceSelected: { backgroundColor: ds.colors.brandSoft, borderColor: ds.colors.brand },
  choiceText: { color: ds.colors.text, flex: 1, fontSize: ds.type.body, lineHeight: 23 },
  choiceTextSelected: { color: ds.colors.brandDark, fontWeight: '800' },
  disclaimer: { color: ds.colors.textMuted, fontSize: ds.type.micro, lineHeight: 17, textAlign: 'center' },
  errorText: { color: ds.colors.danger, fontSize: ds.type.caption, fontWeight: '800', lineHeight: 19 },
  flagButton: {
    alignItems: 'center',
    borderColor: ds.colors.border,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: ds.spacing.md,
    minHeight: ds.touch.min,
    paddingHorizontal: ds.spacing.md,
  },
  flagButtonSelected: { backgroundColor: ds.colors.warmSoft, borderColor: ds.colors.warm },
  flagButtonText: { color: ds.colors.textMuted, fontSize: ds.type.caption, fontWeight: '900' },
  flagButtonTextSelected: { color: ds.colors.warmInkStrong },
  flagDot: { backgroundColor: ds.colors.warm, borderRadius: 4, height: 7, position: 'absolute', right: 5, top: 5, width: 7 },
  flexButton: { flex: 1 },
  flexContent: { flex: 1, minWidth: 0 },
  historyRow: { alignItems: 'center', borderBottomColor: ds.colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: ds.spacing.md, paddingVertical: ds.spacing.sm },
  historyScore: { color: ds.colors.brandDark, fontSize: ds.type.heading, fontWeight: '900' },
  historyTitle: { color: ds.colors.text, fontSize: ds.type.body, fontWeight: '900' },
  instructionIndex: { color: ds.colors.brandDark, fontSize: ds.type.heading, fontWeight: '900', width: 28 },
  instructionRow: { alignItems: 'center', borderBottomColor: ds.colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: ds.spacing.sm, paddingVertical: ds.spacing.md },
  itemType: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900', marginBottom: ds.spacing.sm, textTransform: 'uppercase' },
  metaText: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 19, marginTop: 2 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, marginTop: ds.spacing.md },
  paletteAnswered: { backgroundColor: ds.colors.brand },
  paletteCurrent: { borderColor: ds.colors.warm, borderWidth: 3 },
  paletteItem: { alignItems: 'center', backgroundColor: ds.colors.surface, borderColor: ds.colors.border, borderRadius: ds.radius.sm, borderWidth: 1, height: ds.touch.min, justifyContent: 'center', position: 'relative', width: ds.touch.min },
  paletteText: { color: ds.colors.text, fontSize: ds.type.caption, fontWeight: '900' },
  paletteTextAnswered: { color: ds.colors.brandInk },
  pressed: { opacity: 0.76 },
  progressRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  prompt: { color: ds.colors.text, fontSize: ds.type.heading, fontWeight: '900', lineHeight: 27, marginBottom: ds.spacing.md },
  resultHero: { alignItems: 'center' },
  resultPercent: { color: ds.colors.brandInk, fontSize: ds.type.display, fontWeight: '900' },
  resultRow: { alignItems: 'center', borderBottomColor: ds.colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: ds.spacing.md, paddingVertical: ds.spacing.md },
  reviewAnswer: { color: ds.colors.text, fontSize: ds.type.caption, fontWeight: '900', marginTop: ds.spacing.sm },
  reviewExplanation: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 20, marginTop: ds.spacing.sm },
  reviewNumber: { color: ds.colors.textMuted, fontSize: ds.type.micro, fontWeight: '900', textTransform: 'uppercase' },
  reviewPrompt: { color: ds.colors.text, fontSize: ds.type.body, fontWeight: '900', lineHeight: 22, marginTop: ds.spacing.sm },
  reviewTranscript: { color: ds.colors.brandDark, fontSize: ds.type.body, lineHeight: 22, marginTop: ds.spacing.sm },
  stimulus: { backgroundColor: ds.colors.surfaceAlt, borderRadius: ds.radius.md, marginBottom: ds.spacing.md, padding: ds.spacing.md },
  stimulusText: { color: ds.colors.text, fontSize: ds.type.body, lineHeight: 25, marginTop: ds.spacing.sm },
  stimulusTitle: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900' },
  timerCard: { paddingVertical: ds.spacing.sm },
  timerDanger: { color: ds.colors.danger },
  timerHint: { color: ds.colors.textMuted, fontSize: ds.type.micro, marginTop: 2 },
  timerPolicy: { color: ds.colors.text, fontSize: ds.type.caption, fontWeight: '900' },
  timerRow: { alignItems: 'center', flexDirection: 'row', gap: ds.spacing.md },
  timerValue: { color: ds.colors.brandDark, fontSize: ds.type.title, fontVariant: ['tabular-nums'], fontWeight: '900' },
});
