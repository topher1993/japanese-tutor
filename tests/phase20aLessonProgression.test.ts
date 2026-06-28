import { describe, expect, it } from 'vitest';

import { buildLessonProgression } from '../src/services/lessonProgressionService';

describe('Phase 20A lesson progression (Week 1 → N)', () => {
  it('builds a multi-week progression', () => {
    const progression = buildLessonProgression();
    expect(progression.weeks.length).toBeGreaterThan(0);
    expect(progression.currentWeek).toBeGreaterThanOrEqual(1);
    expect(progression.currentWeek).toBeLessThanOrEqual(progression.weeks.length);
  });

  it('every week has id, label, and objectives', () => {
    const progression = buildLessonProgression();
    for (const week of progression.weeks) {
      expect(week.id.trim().length).toBeGreaterThan(0);
      expect(week.label.trim().length).toBeGreaterThan(0);
      expect(week.objectives.length).toBeGreaterThan(0);
    }
  });

  it('weeks are ordered sequentially', () => {
    const progression = buildLessonProgression();
    for (let i = 0; i < progression.weeks.length; i++) {
      expect(progression.weeks[i].weekNumber).toBe(i + 1);
    }
  });

  it('can advance and rewind the current week without skipping', () => {
    const progression = buildLessonProgression();
    const advanced = progression.advance();
    expect(advanced.currentWeek).toBe(Math.min(progression.currentWeek + 1, progression.weeks.length));
    const rewound = advanced.rewind();
    expect(rewound.currentWeek).toBe(Math.max(progression.currentWeek - 1, 1));
  });
});