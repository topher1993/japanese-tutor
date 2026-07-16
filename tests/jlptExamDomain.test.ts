import { describe, expect, it } from 'vitest';
import { JLPT_EXAM_BLUEPRINTS, getJlptSectionQuestionCount } from '../src/data/jlptExamBlueprints';
import { assembleJlptExam, validateJlptExamQuestion } from '../src/services/jlptExamAssembler';
import { buildJlptExamQuestionBank, getJlptExamQuestionBankCounts } from '../src/services/jlptExamContentService';
import { scoreJlptExamAttempt } from '../src/services/jlptExamScoringService';
import {
  abandonJlptExam,
  answerJlptQuestion,
  continueJlptExam,
  createJlptExamAttempt,
  getCurrentJlptQuestion,
  getJlptRemainingSeconds,
  navigateJlptQuestion,
  pauseJlptExam,
  reconcileJlptExamDeadline,
  recordJlptAudioPlayback,
  resumeJlptExam,
  submitCurrentJlptSection,
  toggleJlptQuestionFlag,
} from '../src/services/jlptExamSessionService';
import type { JlptExamMode, JlptLevel } from '../src/types/jlptExam';

const levels: JlptLevel[] = ['N5', 'N4', 'N3'];
const modes: JlptExamMode[] = ['mini', 'full'];

describe('JLPT exam blueprints and content', () => {
  it('matches the published full section timings for N5, N4, and N3', () => {
    expect(JLPT_EXAM_BLUEPRINTS.N5.sections.map(section => section.fullDurationSeconds)).toEqual([20 * 60, 40 * 60, 30 * 60]);
    expect(JLPT_EXAM_BLUEPRINTS.N4.sections.map(section => section.fullDurationSeconds)).toEqual([25 * 60, 55 * 60, 35 * 60]);
    expect(JLPT_EXAM_BLUEPRINTS.N3.sections.map(section => section.fullDurationSeconds)).toEqual([30 * 60, 70 * 60, 40 * 60]);
  });

  for (const level of levels) {
    it(`${level} exposes only approved, traceable questions and satisfies every full quota`, () => {
      const bank = buildJlptExamQuestionBank(level);
      const counts = getJlptExamQuestionBankCounts(level);
      expect(bank.length).toBeGreaterThan(0);
      expect(counts.total).toBe(bank.length);
      expect(bank.every(question => question.reviewStatus === 'approved-for-exam')).toBe(true);
      expect(bank.every(question => question.sourceRefs.length > 0)).toBe(true);
      expect(new Set(bank.map(question => question.id)).size).toBe(bank.length);
      for (const section of JLPT_EXAM_BLUEPRINTS[level].sections) {
        for (const slot of section.slots) {
          expect(counts.byItemType[slot.itemType] ?? 0).toBeGreaterThanOrEqual(slot.fullCount);
        }
      }
    });
  }
});

describe('JLPT deterministic assembly', () => {
  for (const level of levels) {
    const bank = buildJlptExamQuestionBank(level);
    for (const mode of modes) {
      it(`assembles a deterministic, duplicate-free ${level} ${mode} mock`, () => {
        const first = assembleJlptExam(level, mode, 123456, bank);
        const second = assembleJlptExam(level, mode, 123456, bank);
        expect(second).toEqual(first);
        expect(first.sections).toHaveLength(3);
        const allQuestions = first.sections.flatMap(section => section.questions);
        expect(new Set(allQuestions.map(question => question.id)).size).toBe(allQuestions.length);
        first.sections.forEach((section, index) => {
          const blueprint = JLPT_EXAM_BLUEPRINTS[level].sections[index];
          expect(section.questions).toHaveLength(getJlptSectionQuestionCount(blueprint, mode));
          expect(section.questions.every(question => question.section === section.id)).toBe(true);
        });
        expect(allQuestions.every(question => new Set(question.choices.map(choice => choice.text)).size === question.choices.length)).toBe(true);
      });
    }
  }

  it('rejects duplicate question ids in an injected bank', () => {
    const bank = buildJlptExamQuestionBank('N5');
    expect(() => assembleJlptExam('N5', 'mini', 123, [...bank, { ...bank[0] }]))
      .toThrow(/duplicate JLPT exam question id/i);
  });

  it('rejects injected questions without valid source provenance', () => {
    const bank = buildJlptExamQuestionBank('N4');
    const invalid = { ...bank[0], sourceRefs: [] };
    expect(validateJlptExamQuestion(invalid, JLPT_EXAM_BLUEPRINTS.N4))
      .toContain('At least one source reference is required.');
    expect(() => assembleJlptExam('N4', 'mini', 456, [invalid, ...bank.slice(1)]))
      .toThrow(/invalid JLPT exam question/i);
  });
});

describe('JLPT attempt state and scoring', () => {
  it('supports answer editing, flags, navigation, timeout locking, and section advance', () => {
    const exam = assembleJlptExam('N5', 'mini', 77);
    let attempt = createJlptExamAttempt(exam, 'strict', 1_000);
    const first = getCurrentJlptQuestion(attempt)!;
    attempt = answerJlptQuestion(attempt, first.id, first.choices[1].id, 2_000);
    attempt = answerJlptQuestion(attempt, first.id, first.correctChoice, 3_000);
    attempt = toggleJlptQuestionFlag(attempt, first.id, 4_000);
    attempt = navigateJlptQuestion(attempt, 2, 5_000);
    expect(attempt.answers[first.id]).toBe(first.correctChoice);
    expect(attempt.flaggedQuestionIds).toContain(first.id);
    expect(attempt.currentQuestionIndex).toBe(2);

    attempt = reconcileJlptExamDeadline(attempt, attempt.sectionDeadlineAt!);
    expect(attempt.status).toBe('section-break');
    expect(attempt.sectionSubmissions[0].reason).toBe('timeout');
    const locked = answerJlptQuestion(attempt, first.id, first.choices[1].id, attempt.updatedAt + 1);
    expect(locked).toBe(attempt);

    attempt = continueJlptExam(attempt, attempt.updatedAt + 1_000);
    expect(attempt.status).toBe('active');
    expect(attempt.currentSectionIndex).toBe(1);
    expect(attempt.currentQuestionIndex).toBe(0);
  });

  it('pauses only practice timers and preserves remaining time on resume', () => {
    const exam = assembleJlptExam('N4', 'mini', 88);
    const started = createJlptExamAttempt(exam, 'practice', 10_000);
    const paused = pauseJlptExam(started, 20_000);
    const resumed = resumeJlptExam(paused, 50_000);
    expect(paused.status).toBe('paused');
    expect(resumed.status).toBe('active');
    expect(resumed.sectionDeadlineAt! - started.sectionDeadlineAt!).toBe(30_000);
  });

  it('supports pausing and resuming when pausedAt is zero', () => {
    const exam = assembleJlptExam('N5', 'mini', 89);
    const started = createJlptExamAttempt(exam, 'practice', 0);
    const paused = pauseJlptExam(started, 0);
    const remaining = getJlptRemainingSeconds(paused, 10_000);
    const resumed = resumeJlptExam(paused, 5_000);
    expect(paused.status).toBe('paused');
    expect(paused.pausedAt).toBe(0);
    expect(remaining).toBe(exam.sections[0].durationSeconds);
    expect(resumed.status).toBe('active');
    expect(resumed.sectionDeadlineAt! - started.sectionDeadlineAt!).toBe(5_000);
  });

  it('reconciles an expired deadline before answers, navigation, flags, or manual submission', () => {
    const exam = assembleJlptExam('N5', 'mini', 90);

    const answerAttempt = createJlptExamAttempt(exam, 'strict', 1_000);
    const first = getCurrentJlptQuestion(answerAttempt)!;
    const lateAnswer = answerJlptQuestion(answerAttempt, first.id, first.correctChoice, answerAttempt.sectionDeadlineAt!);
    expect(lateAnswer.status).toBe('section-break');
    expect(lateAnswer.answers[first.id]).toBeUndefined();
    expect(lateAnswer.sectionSubmissions[0].reason).toBe('timeout');

    const navigationAttempt = createJlptExamAttempt(exam, 'strict', 2_000);
    const lateNavigation = navigateJlptQuestion(navigationAttempt, 2, navigationAttempt.sectionDeadlineAt!);
    expect(lateNavigation.status).toBe('section-break');
    expect(lateNavigation.currentQuestionIndex).toBe(0);

    const flagAttempt = createJlptExamAttempt(exam, 'strict', 3_000);
    const flaggedQuestion = getCurrentJlptQuestion(flagAttempt)!;
    const lateFlag = toggleJlptQuestionFlag(flagAttempt, flaggedQuestion.id, flagAttempt.sectionDeadlineAt!);
    expect(lateFlag.status).toBe('section-break');
    expect(lateFlag.flaggedQuestionIds).not.toContain(flaggedQuestion.id);

    const submitAttempt = createJlptExamAttempt(exam, 'strict', 4_000);
    const lateSubmit = submitCurrentJlptSection(submitAttempt, 'submitted', submitAttempt.sectionDeadlineAt!);
    expect(lateSubmit.sectionSubmissions[0].reason).toBe('timeout');
  });

  it('does not record audio playback after the listening deadline', () => {
    const exam = assembleJlptExam('N4', 'mini', 91);
    let attempt = createJlptExamAttempt(exam, 'strict', 1_000);
    attempt = submitCurrentJlptSection(attempt, 'submitted', 2_000);
    attempt = continueJlptExam(attempt, 3_000);
    attempt = submitCurrentJlptSection(attempt, 'submitted', 4_000);
    attempt = continueJlptExam(attempt, 5_000);
    const audioQuestion = attempt.sections[2].questions.find(question => question.stimulus?.kind === 'audio')!;
    attempt = recordJlptAudioPlayback(attempt, audioQuestion.id, 'started', attempt.sectionDeadlineAt!);
    expect(attempt.status).toBe('completed');
    expect(attempt.sectionSubmissions.at(-1)?.reason).toBe('timeout');
    expect(attempt.audioPlayback[audioQuestion.id]).toBeUndefined();
  });

  it('does not expose final scoring for an unfinished or abandoned attempt', () => {
    const exam = assembleJlptExam('N3', 'mini', 92);
    const active = createJlptExamAttempt(exam, 'strict', 1_000);
    const abandoned = abandonJlptExam(active, 2_000);
    expect(() => scoreJlptExamAttempt(active)).toThrow(/only for completed attempts/i);
    expect(() => scoreJlptExamAttempt(abandoned)).toThrow(/only for completed attempts/i);
  });

  it('scores completed practice by section without presenting an official score', () => {
    const exam = assembleJlptExam('N3', 'mini', 99);
    let attempt = createJlptExamAttempt(exam, 'strict', 100);
    for (let sectionIndex = 0; sectionIndex < exam.sections.length; sectionIndex += 1) {
      for (const question of exam.sections[sectionIndex].questions) {
        attempt = answerJlptQuestion(attempt, question.id, question.correctChoice, attempt.updatedAt + 1);
      }
      attempt = submitCurrentJlptSection(attempt, 'submitted', attempt.updatedAt + 1);
      if (sectionIndex < exam.sections.length - 1) attempt = continueJlptExam(attempt, attempt.updatedAt + 1);
    }
    const result = scoreJlptExamAttempt(attempt);
    expect(attempt.status).toBe('completed');
    expect(result.correct).toBe(result.total);
    expect(result.accuracyPercent).toBe(100);
    expect(result.bySection).toHaveLength(3);
    expect(result.unofficialNotice).toMatch(/not an official JLPT score/i);
  });
});
