const BACKUP_REMINDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function needsBackupReminder(lastBackupAt: string | null, now = new Date()): boolean {
  if (!lastBackupAt) return true;
  const backupTime = Date.parse(lastBackupAt);
  return Number.isNaN(backupTime) || now.getTime() - backupTime > BACKUP_REMINDER_AGE_MS;
}
