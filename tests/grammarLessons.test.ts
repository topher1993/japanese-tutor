import { describe, expect, it } from 'vitest';
import { grammarLessons } from '../src/data/grammarLessons';
import { getAllCourseLessons, getAllLessons, getDailyLesson, getGrammarLessons, getPhraseLessons } from '../src/services/lessonService';
import { buildWeeklyTodoBoard } from '../src/services/weeklyTodoService';
import { getAllWeekPlans, getWeekPlan } from '../src/services/weeklyPlansService';

describe('v1.1 grammar curriculum', () => {
  it('contains the complete 50-lesson grammar track', () => {
    expect(grammarLessons).toHaveLength(50);
    expect(getGrammarLessons().length).toBeGreaterThanOrEqual(50);
    expect(new Set(grammarLessons.map(lesson => lesson.id)).size).toBe(grammarLessons.length);
    expect(grammarLessons.every(lesson => lesson.category === 'grammar')).toBe(true);
    expect(grammarLessons.every(lesson => lesson.items.length >= 2)).toBe(true);
    expect(grammarLessons.flatMap(lesson => lesson.items).every(item => item.formation && item.exampleJapanese && item.exampleEnglish)).toBe(true);
  });

  it('includes the adjective rules and irregular いい forms', () => {
    const adjectiveLessons = grammarLessons.filter(lesson => /adjective/i.test(lesson.title));
    const adjectiveContent = adjectiveLessons.flatMap(lesson => lesson.items).map(item => `${item.japanese} ${item.formation}`).join(' ');
    expect(adjectiveLessons.length).toBeGreaterThanOrEqual(4);
    expect(adjectiveContent).toContain('高くない');
    expect(adjectiveContent).toContain('高かった');
    expect(adjectiveContent).toContain('静かではありません');
    expect(adjectiveContent).toContain('よかった');
    expect(adjectiveContent).toContain('くなる');
  });

  it('keeps the existing phrase lessons separate from the grammar track', () => {
    const phraseLessons = getPhraseLessons();
    expect(phraseLessons.some(lesson => lesson.id === 'lesson-workplace-greetings')).toBe(true);
    expect(phraseLessons.some(lesson => lesson.id === 'lesson-week3-restaurant')).toBe(true);
    expect(phraseLessons.every(lesson => lesson.category !== 'grammar')).toBe(true);
    const legacyGrammar = getAllLessons().filter(lesson => lesson.category === 'grammar');
    expect(legacyGrammar.length).toBeGreaterThan(0);
    expect(legacyGrammar.every(lesson => getGrammarLessons().some(candidate => candidate.id === lesson.id))).toBe(true);
  });

  it('exposes a combined catalog for cross-track progress without changing phrase defaults', () => {
    expect(getAllCourseLessons()).toHaveLength(getPhraseLessons().length + getGrammarLessons().length);
    expect(new Set(getAllCourseLessons().map(lesson => lesson.id)).size).toBe(getAllCourseLessons().length);
    expect(getAllCourseLessons().some(lesson => lesson.id === grammarLessons[0].id)).toBe(true);
  });

  it('keeps Home daily progression on the learner-visible phrase track', () => {
    const daily = getDailyLesson({
      startedAt: '2026-07-14',
      completedLessonIds: [],
      quizScores: [],
      streak: { currentStreak: 0, longestStreak: 0 },
    }, 'N4');

    expect(daily.lesson.category).not.toBe('grammar');
    expect(getPhraseLessons().some(lesson => lesson.id === daily.lesson.id)).toBe(true);
  });

  it('filters weekly todo boards by track', () => {
    const board = buildWeeklyTodoBoard(1, {
      weekNumber: 1,
      todos: [
        { id: 'phrases', kind: 'lesson', title: 'Phrases', target: 1, lessonIds: ['lesson-workplace-greetings'], track: 'phrases' },
        { id: 'grammar', kind: 'lesson', title: 'Grammar', target: 1, lessonIds: [grammarLessons[0].id], track: 'grammar' },
      ],
    }, {}, true, 'all', 1, 'grammar');

    expect(board.todos.map(status => status.todo.id)).toEqual(['grammar']);
    expect(board.totalCount).toBe(1);
  });

  it('provides grammar-specific weekly goals without changing the phrase plan', () => {
    const grammarPlan = getWeekPlan(1, 'grammar');
    expect(grammarPlan?.todos[0]?.id).toBe('grammar-w1-lessons');
    expect(grammarPlan?.todos[0]?.track).toBe('grammar');
    expect(grammarPlan?.todos[0]?.lessonIds).toContain(grammarLessons[0].id);
    expect(getAllWeekPlans()).toHaveLength(1);
    expect(getAllWeekPlans('grammar').length).toBeGreaterThan(1);
  });
});
