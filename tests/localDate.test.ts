import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addLocalDateDays,
  localCalendarDayDifference,
  localDateKey,
  localDayNumber,
} from '../src/utils/localDate';

const originalTimezone = process.env.TZ;

describe('learner-local calendar helpers', () => {
  beforeAll(() => { process.env.TZ = 'Asia/Tokyo'; });
  afterAll(() => {
    if (originalTimezone == null) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  it('uses Japan midnight even while UTC is on the prior date', () => {
    expect(localDateKey(new Date('2026-07-13T15:30:00.000Z'))).toBe('2026-07-14');
  });

  it('adds and compares calendar dates without DST or timezone drift', () => {
    expect(addLocalDateDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addLocalDateDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(localCalendarDayDifference('2026-07-14', '2026-07-10')).toBe(4);
  });

  it('rejects invalid date keys instead of silently scheduling bad data', () => {
    expect(localDayNumber('2026-02-30')).toBeUndefined();
    expect(() => addLocalDateDays('not-a-date', 1)).toThrow(RangeError);
  });
});
