/**
 * Calendar filtering shared by the build, the browser script and the tests.
 * Pure functions only: no DOM and no clock access.
 */

/** Lowercases and strips diacritics so "tabor" finds "Tábor". Display text is never changed. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface EventIndex {
  /** `YYYY-MM-DD`, or null when the date is not confirmed. */
  date: string | null;
  endDate?: string | null;
  /** Folded searchable text. */
  text: string;
  region: string;
  series: string[];
  types: string[];
}

export interface Filters {
  q: string;
  region: string;
  series: string;
  type: string;
  from: string;
  to: string;
}

export const emptyFilters: Filters = { q: '', region: '', series: '', type: '', from: '', to: '' };

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function matches(event: EventIndex, filters: Filters): boolean {
  if (filters.q) {
    const words = fold(filters.q).split(' ').filter(Boolean);
    if (!words.every((word) => event.text.includes(word))) return false;
  }
  if (filters.region && event.region !== filters.region) return false;
  if (filters.series && !event.series.includes(filters.series)) return false;
  if (filters.type && !event.types.includes(filters.type)) return false;
  if (filters.from || filters.to) {
    // A date range can only match events with a confirmed date.
    if (!event.date) return false;
    const end = event.endDate || event.date;
    if (filters.from && end < filters.from) return false;
    if (filters.to && event.date > filters.to) return false;
  }
  return true;
}

export function isActive(filters: Filters): boolean {
  return Object.values(filters).some((value) => value !== '');
}

export interface AllowedValues {
  regions: readonly string[];
  series: readonly string[];
  types: readonly string[];
}

/** Reads filters from a query string. Unknown or malformed values are dropped, never trusted. */
export function parseFilters(params: URLSearchParams, allowed: AllowedValues): Filters {
  const pick = (name: string, values: readonly string[]) => {
    const value = params.get(name) ?? '';
    return values.includes(value) ? value : '';
  };
  const date = (name: string) => {
    const value = params.get(name) ?? '';
    return isoDate.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : '';
  };
  return {
    q: (params.get('q') ?? '').slice(0, 80).trim(),
    region: pick('region', allowed.regions),
    series: pick('series', allowed.series),
    type: pick('type', allowed.types),
    from: date('from'),
    to: date('to'),
  };
}

export function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params.toString();
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * "This weekend" runs Friday to Sunday, because evening races such as a
 * Friday World Cup round belong to the weekend for a visitor. On Monday to
 * Thursday it is the coming weekend; from Friday on it is the current one.
 */
export function weekendRange(today: string): { from: string; to: string } {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const toFriday = weekday === 0 ? -2 : weekday === 6 ? -1 : 5 - weekday;
  const friday = addDays(today, toFriday);
  return { from: friday < today ? today : friday, to: addDays(friday, 2) };
}

/** An event counts as past from the day after its last day. */
export function isPast(event: Pick<EventIndex, 'date' | 'endDate'>, today: string): boolean {
  if (!event.date) return false;
  return (event.endDate || event.date) < today;
}
