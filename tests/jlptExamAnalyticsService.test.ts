import { beforeEach, describe, expect, it, vi } from 'vitest';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('../src/services/analyticsService', () => ({ track }));

import { trackJlptExamEvent } from '../src/services/jlptExamAnalyticsService';

describe('JLPT exam analytics', () => {
  beforeEach(() => track.mockClear());

  it('emits only the allow-listed diagnostic payload', () => {
    trackJlptExamEvent('section_submitted', {
      level: 'N4',
      mode: 'full',
      timerPolicy: 'strict',
      section: 'grammar-reading',
      questionCount: 18,
      answeredCount: 17,
      durationSeconds: 3300,
      completionReason: 'timeout',
    });

    expect(track).toHaveBeenCalledWith('jlpt_exam_section_submitted', {
      level: 'N4',
      mode: 'full',
      timer_policy: 'strict',
      section: 'grammar-reading',
      question_count: 18,
      answered_count: 17,
      duration_seconds: 3300,
      completion_reason: 'timeout',
    });
    const payload = track.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload)).not.toEqual(expect.arrayContaining(['prompt', 'answer', 'transcript', 'choice']));
  });

  it('maps listening failures without accepting free text', () => {
    trackJlptExamEvent('audio_failed', {
      level: 'N5',
      mode: 'mini',
      timerPolicy: 'practice',
      section: 'listening',
      errorCode: 'playback-failed',
    });

    expect(track).toHaveBeenCalledWith('jlpt_exam_audio_failed', {
      level: 'N5',
      mode: 'mini',
      timer_policy: 'practice',
      section: 'listening',
      error_code: 'playback-failed',
    });
  });
});
