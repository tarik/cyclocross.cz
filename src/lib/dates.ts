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
  // Tests pin the build date so grouping into upcoming and past is predictable.
  if (arguments.length === 0 && process.env.BUILD_TODAY) return process.env.BUILD_TODAY;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(now);
}

/** A single day or a multi-day range, for example "5.–6. prosince 2026" is not attempted: both ends are written in full. */
export function formatEventDates(startDate: string, endDate: string | undefined, locale: Locale): string {
  if (!endDate || endDate === startDate) return formatEventDate(startDate, locale);
  return `${formatEventDate(startDate, locale)} – ${formatEventDate(endDate, locale)}`;
}

/** Short numeric form for dense lists, for example "27. 11." or "27 Nov". */
export function formatShortDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(intlLocale[locale], { weekday: 'short', day: 'numeric', month: locale === 'cs' ? 'numeric' : 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
