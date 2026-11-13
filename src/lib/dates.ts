import type { Locale } from '../i18n/routes.ts';

const intlLocale: Record<Locale, string> = { cs: 'cs-CZ', en: 'en-GB' };

/**
 * Formats a calendar date (`YYYY-MM-DD`) for display. Event dates are plain
 * local dates in Europe/Prague, so they are formatted as written and never
 * shifted by the build machine's or the visitor's time zone.
 */
export function formatEventDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(intlLocale[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Today's calendar date in Europe/Prague as `YYYY-MM-DD`. */
export function todayInPrague(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(now);
}
