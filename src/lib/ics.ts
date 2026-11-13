/**
 * iCalendar (RFC 5545) output for single events and the season feed.
 * Rules from SPEC.md 6.4: stable UIDs, all-day versus timed events kept
 * apart, no invented start or end times, cancellations exported as such.
 */
import type { EventRecord } from './schemas.ts';

const CRLF = '\r\n';

export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const compactDate = (date: string) => date.replaceAll('-', '');
const compactTime = (time: string) => `${time.replace(':', '')}00`;
const utcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Prague',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export interface IcsOptions {
  /** Absolute URL of the event page. */
  url: string;
}

/** Returns the VEVENT lines, or null when the event has no confirmed day to put in a calendar. */
export function eventLines(event: EventRecord, { url }: IcsOptions): string[] | null {
  const { timing } = event;
  if (timing.precision !== 'day' || !timing.startDate) return null;

  const lines = ['BEGIN:VEVENT', `UID:${event.id}@cyclocross.cz`, `DTSTAMP:${utcStamp(event.feed.lastModified)}`];
  if (timing.startTime) {
    lines.push(`DTSTART;TZID=Europe/Prague:${compactDate(timing.startDate)}T${compactTime(timing.startTime)}`);
    // Without a known end time the event has no DTEND: an invented duration would be a false claim.
    if (timing.endTime) {
      lines.push(`DTEND;TZID=Europe/Prague:${compactDate(timing.endDate ?? timing.startDate)}T${compactTime(timing.endTime)}`);
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(timing.startDate)}`);
    // DTEND is exclusive for all-day events.
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(timing.endDate ?? timing.startDate))}`);
  }
  lines.push(`SUMMARY:${escapeText(event.name.official)}`);
  const place = [event.location.venue, event.location.town].filter(Boolean).join(', ');
  if (place) lines.push(`LOCATION:${escapeText(place)}`);
  if (event.location.coordinates) lines.push(`GEO:${event.location.coordinates.lat};${event.location.coordinates.lon}`);
  lines.push(`URL:${url}`);
  lines.push(`DESCRIPTION:${escapeText([event.links.official, url].filter(Boolean).join('\n'))}`);
  lines.push(`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : event.status === 'postponed' ? 'TENTATIVE' : 'CONFIRMED'}`);
  lines.push(`SEQUENCE:${event.feed.sequence}`);
  lines.push(`LAST-MODIFIED:${utcStamp(event.feed.lastModified)}`);
  lines.push('END:VEVENT');
  return lines;
}

export function calendar(name: string, events: { event: EventRecord; url: string }[]): string {
  const body = events.flatMap(({ event, url }) => eventLines(event, { url }) ?? []);
  const timed = events.some(({ event }) => event.timing.startTime);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//cyclocross.cz//Calendar//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    'X-WR-TIMEZONE:Europe/Prague',
    ...(timed ? VTIMEZONE : []),
    ...body,
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
