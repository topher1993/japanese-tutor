import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('JLPT mock exam navigation integration', () => {
  it('offers the mock exam from Test without replacing quick practice', () => {
    const quiz = source('src/screens/QuizScreen.tsx');
    expect(quiz).toContain('JLPT-style Mock Exam');
    expect(quiz).toContain('onOpenJlptExam');
    expect(quiz).toContain('buildQuizPracticeSession');
    expect(quiz).toContain('Unofficial practice');
  });

  it('threads a dedicated full-screen navigation flag through the app shell', () => {
    const navigation = source('src/app/useAppNavigation.ts');
    const renderTab = source('src/app/renderTab.tsx');
    const app = source('App.tsx');
    expect(navigation).toContain('showJlptExam');
    expect(navigation).toContain("getParam('screen') === 'jlpt-exam'");
    expect(renderTab).toContain('onOpenJlptExam');
    expect(app).toContain('nav.setShowJlptExam(true)');
    expect(app).toContain('if (nav.showJlptExam)');
    expect(app).toContain('<JlptExamFlowScreen');
    expect(app).toContain('repository={jlptExamRepository}');
    expect(app).toContain('nav.setShowJlptExam(false)');
  });

  it('uses shared durable app storage and includes mock data in reset-all', () => {
    const storage = source('src/app/jlptExamStorage.ts');
    const app = source('App.tsx');
    const settings = source('src/screens/SettingsScreen.tsx');
    expect(storage).toContain('openOnboardingStorage');
    expect(storage).toContain('createJlptExamAttemptRepository');
    expect(storage).toContain('sharedRepository');
    expect(app).toContain('jlptExamRepository.clearAll()');
    expect(settings).toContain('JLPT-style mock history');
  });
});
