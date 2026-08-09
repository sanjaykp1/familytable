import type { DayKey, Season } from './types';
import { DAY_KEYS } from './types';

const DAY_MS = 86_400_000;

export function toLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toISODateLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfWeek(date = new Date()): string {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  const weekday = result.getDay();
  result.setDate(result.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return toISODateLocal(result);
}

export function addDays(isoDate: string, amount: number): string {
  const date = toLocalDate(isoDate);
  date.setDate(date.getDate() + amount);
  return toISODateLocal(date);
}

export function addWeeks(weekStart: string, amount: number): string {
  return addDays(weekStart, amount * 7);
}

export function dayDate(weekStart: string, day: DayKey): string {
  return addDays(weekStart, DAY_KEYS.indexOf(day));
}

export function formatWeekRange(weekStart: string): string {
  const start = toLocalDate(weekStart);
  const end = toLocalDate(addDays(weekStart, 6));
  const startText = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endText = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: start.getFullYear() === end.getFullYear() ? undefined : 'numeric',
  });
  return `${startText} – ${endText}`;
}

export function formatDayDate(isoDate: string): string {
  return toLocalDate(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === startOfWeek();
}

export function seasonForWeek(weekStart: string): Season {
  const month = toLocalDate(addDays(weekStart, 3)).getMonth();
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((toLocalDate(toIso).getTime() - toLocalDate(fromIso).getTime()) / DAY_MS);
}
