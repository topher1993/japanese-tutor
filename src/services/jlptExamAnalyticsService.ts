import { track, type AnalyticsEvent } from './analyticsService';

export type JlptExamTelemetryEvent =
  | 'started'
  | 'resumed'
  | 'section_submitted'
  | 'completed'
  | 'abandoned'
  | 'audio_failed';

export interface JlptExamTelemetry {
  level: 'N5' | 'N4' | 'N3';
  mode: 'mini' | 'full';
  timerPolicy: 'strict' | 'practice';
  section?: 'vocabulary' | 'grammar-reading' | 'listening';
  questionCount?: number;
  answeredCount?: number;
  durationSeconds?: number;
  completionReason?: 'submitted' | 'timeout' | 'exit';
  errorCode?: 'speech-unavailable' | 'playback-failed' | 'interrupted';
}

const EVENT_NAMES: Record<JlptExamTelemetryEvent, AnalyticsEvent> = {
  started: 'jlpt_exam_started',
  resumed: 'jlpt_exam_resumed',
  section_submitted: 'jlpt_exam_section_submitted',
  completed: 'jlpt_exam_completed',
  abandoned: 'jlpt_exam_abandoned',
  audio_failed: 'jlpt_exam_audio_failed',
};

/**
 * Emit an allow-listed JLPT practice event. The typed payload deliberately has
 * no prompt, choice, answer, transcript, or free-text field, so learner
 * responses and licensed source content cannot reach analytics by accident.
 */
export function trackJlptExamEvent(event: JlptExamTelemetryEvent, payload: JlptExamTelemetry): void {
  track(EVENT_NAMES[event], {
    level: payload.level,
    mode: payload.mode,
    timer_policy: payload.timerPolicy,
    ...(payload.section ? { section: payload.section } : {}),
    ...(payload.questionCount !== undefined ? { question_count: payload.questionCount } : {}),
    ...(payload.answeredCount !== undefined ? { answered_count: payload.answeredCount } : {}),
    ...(payload.durationSeconds !== undefined ? { duration_seconds: payload.durationSeconds } : {}),
    ...(payload.completionReason ? { completion_reason: payload.completionReason } : {}),
    ...(payload.errorCode ? { error_code: payload.errorCode } : {}),
  });
}
