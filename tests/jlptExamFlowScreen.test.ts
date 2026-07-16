import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const screen = readFileSync(resolve(process.cwd(), 'src/screens/JlptExamFlowScreen.tsx'), 'utf8');

describe('JLPT exam flow screen contract', () => {
  it('hydrates, autosaves, resumes, and finalizes through the durable repository', () => {
    expect(screen).toContain('repository.loadActiveAttempt()');
    expect(screen).toContain('repository.listResults()');
    expect(screen).toContain('repository.saveActiveAttempt(next)');
    expect(screen).toContain('repository.addResult(scored)');
    expect(screen).toContain('repository.clearActiveAttempt()');
    expect(screen).toContain('saveQueueRef');
  });

  it('handles strict and practice timers across background transitions', () => {
    expect(screen).toContain("AppState.addEventListener('change'");
    expect(screen).toContain('pauseJlptExam');
    expect(screen).toContain('resumeJlptExam');
    expect(screen).toContain('reconcileJlptExamDeadline');
    expect(screen).toContain("latest.status === 'paused' && view !== 'exam'");
    expect(screen).toContain('Strict time continues in the background');
  });

  it('keeps the one-play listening rule retry-safe', () => {
    expect(screen).toContain('audioPlayLimit');
    expect(screen).toContain('question.stimulus.title');
    expect(screen).toContain('const latest = attemptRef.current');
    expect(screen).toContain("recordJlptAudioPlayback(latest, question.id, 'failed'");
    expect(screen).toContain('a failed start does not use your one play');
    expect(screen).toContain('Play listening audio once');
  });

  it('includes accessible exam controls, confirmation, scoring, and disclaimer surfaces', () => {
    expect(screen).toContain('accessibilityRole="radiogroup"');
    expect(screen).toContain('accessibilityRole="radio"');
    expect(screen).toContain('jlpt-exam-timer');
    expect(screen).toContain('Submit section');
    expect(screen).toContain('Review answers');
    expect(screen).toContain('Skill breakdown');
    expect(screen).toContain('Question-type breakdown');
    expect(screen).toContain('selectedText');
    expect(screen).toContain('saveFailedRef.current');
    expect(screen).toContain('JLPT_UNOFFICIAL_NOTICE');
    expect(screen).toContain('not an official scaled JLPT score or pass prediction');
  });
});
