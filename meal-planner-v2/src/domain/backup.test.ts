import { describe, expect, it } from 'vitest';
import { needsBackupReminder } from './backup';

describe('needsBackupReminder', () => {
  const now = new Date('2026-08-10T12:00:00.000Z');

  it('reminds when no successful backup has been recorded', () => {
    expect(needsBackupReminder(null, now)).toBe(true);
  });

  it('does not remind for a backup up to seven days old', () => {
    expect(needsBackupReminder('2026-08-03T12:00:00.000Z', now)).toBe(false);
  });

  it('reminds when a backup is older than seven days', () => {
    expect(needsBackupReminder('2026-08-03T11:59:59.999Z', now)).toBe(true);
  });
});
