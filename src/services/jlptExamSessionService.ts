import type {
  JlptAssembledExam,
  JlptChoiceId,
  JlptExamAttempt,
  JlptExamQuestion,
  JlptSectionCompletionReason,
  JlptTimerPolicy,
} from '../types/jlptExam';

export function createJlptExamAttempt(
  exam: JlptAssembledExam,
  timerPolicy: JlptTimerPolicy = 'strict',
  now: number = Date.now(),
): JlptExamAttempt {
  const firstSection = exam.sections[0];
  if (!firstSection) throw new Error('A JLPT exam requires at least one section.');
  return {
    schemaVersion: 1,
    id: `${exam.id}-${now}`,
    level: exam.level,
    mode: exam.mode,
    timerPolicy,
    seed: exam.seed,
    blueprintVersion: exam.blueprintVersion,
    contentVersion: exam.contentVersion,
    sections: exam.sections,
    status: 'active',
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    answers: {},
    flaggedQuestionIds: [],
    sectionSubmissions: [],
    audioPlayback: {},
    sectionStartedAt: now,
    sectionDeadlineAt: now + firstSection.durationSeconds * 1000,
    startedAt: now,
    updatedAt: now,
  };
}

export function getCurrentJlptSection(attempt: JlptExamAttempt) {
  return attempt.sections[attempt.currentSectionIndex];
}

export function getCurrentJlptQuestion(attempt: JlptExamAttempt): JlptExamQuestion | undefined {
  return getCurrentJlptSection(attempt)?.questions[attempt.currentQuestionIndex];
}

export function getJlptRemainingSeconds(attempt: JlptExamAttempt, now: number = Date.now()): number {
  if (attempt.status === 'paused' && attempt.pausedAt !== undefined && attempt.sectionDeadlineAt !== undefined) {
    return Math.max(0, Math.ceil((attempt.sectionDeadlineAt - attempt.pausedAt) / 1000));
  }
  if (attempt.status !== 'active' || !attempt.sectionDeadlineAt) return 0;
  return Math.max(0, Math.ceil((attempt.sectionDeadlineAt - now) / 1000));
}

export function answerJlptQuestion(
  attempt: JlptExamAttempt,
  questionId: string,
  choice: JlptChoiceId,
  now: number = Date.now(),
): JlptExamAttempt {
  const reconciled = reconcileJlptExamDeadline(attempt, now);
  if (reconciled.status !== 'active') return reconciled;
  const currentSection = getCurrentJlptSection(reconciled);
  const question = currentSection?.questions.find(candidate => candidate.id === questionId);
  if (!question || !question.choices.some(candidate => candidate.id === choice)) return reconciled;
  return {
    ...reconciled,
    answers: { ...reconciled.answers, [questionId]: choice },
    updatedAt: now,
  };
}

export function navigateJlptQuestion(
  attempt: JlptExamAttempt,
  questionIndex: number,
  now: number = Date.now(),
): JlptExamAttempt {
  const reconciled = reconcileJlptExamDeadline(attempt, now);
  if (reconciled.status !== 'active') return reconciled;
  const questions = getCurrentJlptSection(reconciled)?.questions ?? [];
  if (questions.length === 0) return reconciled;
  return {
    ...reconciled,
    currentQuestionIndex: Math.max(0, Math.min(questionIndex, questions.length - 1)),
    updatedAt: now,
  };
}

export function toggleJlptQuestionFlag(
  attempt: JlptExamAttempt,
  questionId: string,
  now: number = Date.now(),
): JlptExamAttempt {
  const reconciled = reconcileJlptExamDeadline(attempt, now);
  if (reconciled.status !== 'active') return reconciled;
  if (!getCurrentJlptSection(reconciled)?.questions.some(question => question.id === questionId)) return reconciled;
  const flags = new Set(reconciled.flaggedQuestionIds);
  if (flags.has(questionId)) flags.delete(questionId);
  else flags.add(questionId);
  return { ...reconciled, flaggedQuestionIds: Array.from(flags), updatedAt: now };
}

export function recordJlptAudioPlayback(
  attempt: JlptExamAttempt,
  questionId: string,
  event: 'started' | 'completed' | 'failed',
  now: number = Date.now(),
): JlptExamAttempt {
  const reconciled = reconcileJlptExamDeadline(attempt, now);
  if (reconciled.status !== 'active') return reconciled;
  const question = getCurrentJlptSection(reconciled)?.questions.find(candidate => candidate.id === questionId);
  if (!question || question.stimulus?.kind !== 'audio') return reconciled;
  const prior = reconciled.audioPlayback[questionId] ?? { plays: 0 };
  if (event === 'started' && question.audioPlayLimit !== undefined && prior.plays >= question.audioPlayLimit) return reconciled;
  const next = event === 'started'
    ? { ...prior, plays: prior.plays + 1, startedAt: now, failed: false }
    : event === 'completed'
      ? { ...prior, completedAt: now, failed: false }
      : { ...prior, failed: true };
  return {
    ...reconciled,
    audioPlayback: { ...reconciled.audioPlayback, [questionId]: next },
    updatedAt: now,
  };
}

export function submitCurrentJlptSection(
  attempt: JlptExamAttempt,
  reason: JlptSectionCompletionReason = 'submitted',
  now: number = Date.now(),
): JlptExamAttempt {
  if (attempt.status !== 'active') return attempt;
  const section = getCurrentJlptSection(attempt);
  if (!section) return attempt;
  if (attempt.sectionSubmissions.some(submission => submission.sectionId === section.id)) return attempt;
  const resolvedReason = attempt.sectionDeadlineAt !== undefined && now >= attempt.sectionDeadlineAt
    ? 'timeout'
    : reason;
  const remaining = getJlptRemainingSeconds(attempt, now);
  const elapsedSeconds = Math.max(0, Math.min(section.durationSeconds, section.durationSeconds - remaining));
  const lastSection = attempt.currentSectionIndex >= attempt.sections.length - 1;
  return {
    ...attempt,
    status: lastSection ? 'completed' : 'section-break',
    sectionSubmissions: [
      ...attempt.sectionSubmissions,
      { sectionId: section.id, submittedAt: now, reason: resolvedReason, elapsedSeconds },
    ],
    sectionDeadlineAt: undefined,
    pausedAt: undefined,
    updatedAt: now,
    ...(lastSection ? { completedAt: now } : {}),
  };
}

export function reconcileJlptExamDeadline(
  attempt: JlptExamAttempt,
  now: number = Date.now(),
): JlptExamAttempt {
  if (attempt.status !== 'active' || !attempt.sectionDeadlineAt || attempt.sectionDeadlineAt > now) return attempt;
  return submitCurrentJlptSection(attempt, 'timeout', now);
}

export function continueJlptExam(attempt: JlptExamAttempt, now: number = Date.now()): JlptExamAttempt {
  if (attempt.status !== 'section-break') return attempt;
  const nextIndex = attempt.currentSectionIndex + 1;
  const section = attempt.sections[nextIndex];
  if (!section) return { ...attempt, status: 'completed', completedAt: now, updatedAt: now };
  return {
    ...attempt,
    status: 'active',
    currentSectionIndex: nextIndex,
    currentQuestionIndex: 0,
    sectionStartedAt: now,
    sectionDeadlineAt: now + section.durationSeconds * 1000,
    pausedAt: undefined,
    updatedAt: now,
  };
}

export function pauseJlptExam(attempt: JlptExamAttempt, now: number = Date.now()): JlptExamAttempt {
  const reconciled = reconcileJlptExamDeadline(attempt, now);
  if (reconciled.timerPolicy !== 'practice' || reconciled.status !== 'active') return reconciled;
  return { ...reconciled, status: 'paused', pausedAt: now, updatedAt: now };
}

export function resumeJlptExam(attempt: JlptExamAttempt, now: number = Date.now()): JlptExamAttempt {
  if (attempt.status !== 'paused' || attempt.pausedAt === undefined) return reconcileJlptExamDeadline(attempt, now);
  const pausedDuration = Math.max(0, now - attempt.pausedAt);
  return {
    ...attempt,
    status: 'active',
    sectionStartedAt: attempt.sectionStartedAt + pausedDuration,
    sectionDeadlineAt: attempt.sectionDeadlineAt === undefined ? undefined : attempt.sectionDeadlineAt + pausedDuration,
    pausedAt: undefined,
    updatedAt: now,
  };
}

export function abandonJlptExam(attempt: JlptExamAttempt, now: number = Date.now()): JlptExamAttempt {
  if (attempt.status === 'completed' || attempt.status === 'abandoned') return attempt;
  return {
    ...attempt,
    status: 'abandoned',
    sectionDeadlineAt: undefined,
    pausedAt: undefined,
    updatedAt: now,
  };
}
