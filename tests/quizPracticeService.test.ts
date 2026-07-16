import { describe, expect, it } from 'vitest';
import {
  buildRetryMissedQuizSession,
  buildQuizPracticeSession,
  finishQuizPracticeSession,
  gradeQuizPracticeAnswer,
  getQuizPracticeModeBreakdown,
} from '../src/services/quizPracticeService';

describe('quiz practice modes', () => {
  it('builds a mixed session with all four question types', () => {
    const session = buildQuizPracticeSession('mixed', 'mixed', 10, () => 0.42);
    expect(session.questions).toHaveLength(10);
    expect(new Set(session.questions.map(question => question.kind))).toEqual(new Set(['choice', 'listening', 'builder', 'fillBlank']));
  });

  it('builds listening questions from grammar examples', () => {
    const session = buildQuizPracticeSession('listening', 'grammar', 5, () => 0.31);
    expect(session.questions.length).toBeGreaterThan(0);
    expect(session.questions.every(question => question.kind === 'listening' && question.source === 'grammar')).toBe(true);
    const question = session.questions[0];
    expect(question.kind).toBe('listening');
    if (question.kind === 'listening') {
      expect(question.audioText).toBeTruthy();
      expect(question.choices).toHaveLength(4);
      expect(gradeQuizPracticeAnswer(question, question.correctChoice)).toBe(true);
    }
  });

  it('grades sentence-builder order using token ids', () => {
    const session = buildQuizPracticeSession('builder', 'phrases', 1, () => 0.17);
    const question = session.questions[0];
    expect(question.kind).toBe('builder');
    if (question.kind === 'builder') {
      expect(gradeQuizPracticeAnswer(question, question.correctTokenIds.join('|'))).toBe(true);
      expect(gradeQuizPracticeAnswer(question, [...question.correctTokenIds].reverse().join('|'))).toBe(false);
    }
  });

  it('accepts adjective and conjugation fill-in answers', () => {
    const session = buildQuizPracticeSession('fillBlank', 'grammar', 8, () => 0.23);
    expect(session.questions.length).toBeGreaterThan(0);
    expect(session.questions.every(question => question.kind === 'fillBlank')).toBe(true);
    const adjective = session.questions.find(question => question.id === 'fill-grammar-i-negative');
    expect(adjective?.kind).toBe('fillBlank');
    if (adjective?.kind === 'fillBlank') {
      expect(gradeQuizPracticeAnswer(adjective, ' くない。')).toBe(true);
    }
  });

  it('produces a scored result from answered questions', () => {
    const session = buildQuizPracticeSession('listening', 'phrases', 3, () => 0.5);
    const answers = session.questions.reduce((current, question) => {
      if (question.kind === 'choice' || question.kind === 'listening') current.answers[question.id] = question.correctChoice;
      return current;
    }, { ...session, answers: { ...session.answers } });
    const result = finishQuizPracticeSession({ ...answers, complete: true });
    expect(result.score).toBe(result.total);
  });

  it('breaks results down by mode and creates a retry session from missed questions', () => {
    const session = buildQuizPracticeSession('listening', 'phrases', 3, () => 0.5);
    const answers = session.questions.reduce<Record<string, string>>((current, question, index) => {
      current[question.id] = index === 0
        ? 'wrong-answer'
        : question.kind === 'listening' ? question.correctChoice : '';
      return current;
    }, {});
    const completed = { ...session, answers, complete: true };
    const result = finishQuizPracticeSession(completed);
    const breakdown = getQuizPracticeModeBreakdown(completed, result);
    const retry = buildRetryMissedQuizSession(completed);

    expect(breakdown).toEqual([{ kind: 'listening', label: 'Listening', score: 2, total: 3 }]);
    expect(retry.questions).toHaveLength(1);
    expect(retry.questions[0].id).toBe(session.questions[0].id);
    expect(retry.currentIndex).toBe(0);
    expect(retry.complete).toBe(false);
  });
});
