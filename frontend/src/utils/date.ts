import { format, parseISO, addDays, differenceInCalendarDays, isValid } from 'date-fns';

export const TZ = 'Asia/Karachi';

function toKarachiParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

export function nowKarachi(): Date {
  const p = toKarachiParts(new Date());
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute);
}

/** Calendar year in Asia/Karachi (for display filters). */
export function currentKarachiYear(): number {
  return toKarachiParts(new Date()).year;
}

/** Year + month (1–12) for a timestamp in Asia/Karachi. */
export function getKarachiYearMonth(
  value: string | Date,
): { year: number; month: number } | null {
  const d = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(d)) return null;
  const p = toKarachiParts(d);
  return { year: p.year, month: p.month };
}

/** e.g. "Nov 2026" from Karachi calendar parts. */
export function formatMonthYearLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMM yyyy');
}

/** Display format everywhere: 10-Oct-2026 */
export const DATE_DISPLAY = 'dd-MMM-yyyy';

export function formatDate(value: string | Date, pattern = DATE_DISPLAY): string {
  const d = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(d)) return '—';
  return format(d, pattern);
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, `${DATE_DISPLAY}, hh:mm a`);
}

export function formatTime(value: string | Date): string {
  return formatDate(value, 'hh:mm a');
}

export function todayIso(): string {
  const p = toKarachiParts(new Date());
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  return format(addDays(parseISO(isoDate), days), 'yyyy-MM-dd');
}

export function daysUntil(isoDate: string): number {
  return differenceInCalendarDays(parseISO(isoDate), parseISO(todayIso()));
}

export function weekdayKey(
  date = nowKarachi(),
): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  return map[date.getDay()];
}
