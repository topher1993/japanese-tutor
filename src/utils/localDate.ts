/** Calendar helpers for learner-facing daily boundaries. */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDayNumber(dateKey: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return Math.floor(date.getTime() / 86_400_000);
}

export function addLocalDateDays(dateKey: string, days: number): string {
  const dayNumber = localDayNumber(dateKey);
  if (dayNumber == null) throw new RangeError(`Invalid local date key: ${dateKey}`);
  return new Date((dayNumber + days) * 86_400_000).toISOString().slice(0, 10);
}

/** Signed difference `later - earlier` in calendar days. */
export function localCalendarDayDifference(later: string, earlier: string): number {
  const laterDay = localDayNumber(later);
  const earlierDay = localDayNumber(earlier);
  if (laterDay == null || earlierDay == null) return 0;
  return laterDay - earlierDay;
}
