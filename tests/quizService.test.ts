import { describe, expect, it } from 'vitest';
import { gradeQuiz, getQuickQuiz } from '../src/services/quizService';

describe('quiz service', () => {
  it('grades multiple-choice answers and returns immediate feedback', () => {
    const quiz = getQuickQuiz();
    const answers = Object.fromEntries(quiz.questions.map(question => [question.id, question.correctChoice]));
    const result = gradeQuiz(quiz, answers);
    expect(result.score).toBe(quiz.questions.length);
    expect(result.total).toBe(quiz.questions.length);
    expect(result.feedback.every(item => item.correct)).toBe(true);
  });

  it('marks wrong answers with the correct explanation', () => {
    const quiz = getQuickQuiz();
    const first = quiz.questions[0];
    const wrongChoice = first.choices.find(choice => choice.id !== first.correctChoice)!.id;
    const result = gradeQuiz(quiz, { [first.id]: wrongChoice });
    expect(result.score).toBe(0);
    expect(result.feedback[0]).toMatchObject({ correct: false, correctChoice: first.correctChoice, explanation: first.explanation });
  });
});
