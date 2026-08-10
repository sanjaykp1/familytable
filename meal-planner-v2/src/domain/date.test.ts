import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWeeks,
  dayDate,
  daysBetween,
  seasonForWeek,
  startOfWeek,
  toISODateLocal,
  toLocalDate,
} from './date';

describe('local date helpers', () => {
  it('uses Monday as the start of a week and keeps local calendar dates stable', () => {
    expect(startOfWeek(toLocalDate('2026-08-09'))).toBe('2026-08-03');
    expect(toISODateLocal(toLocalDate('2026-08-03'))).toBe('2026-08-03');
  });

  it('moves across month and year boundaries without using UTC date shifts', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addWeeks('2026-12-28', 1)).toBe('2027-01-04');
    expect(dayDate('2026-08-03', 'sunday')).toBe('2026-08-09');
  });

  it('calculates seasons and date differences from local ISO dates', () => {
    expect(seasonForWeek('2026-03-02')).toBe('spring');
    expect(seasonForWeek('2026-11-30')).toBe('winter');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});
