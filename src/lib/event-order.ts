import type { EventRecord } from './schemas.ts';

/** Chronological order by local date and time; unconfirmed dates last, then by name. */
export function compareEvents(a: EventRecord, b: EventRecord): number {
  const key = (event: EventRecord) => `${event.timing.startDate ?? '9999-99-99'}T${event.timing.startTime ?? '00:00'}`;
  return key(a).localeCompare(key(b)) || a.name.official.localeCompare(b.name.official, 'cs');
}

