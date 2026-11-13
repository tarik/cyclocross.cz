import { describe, expect, it } from 'vitest';
import { emptyFilters, fold, isPast, matches, parseFilters, serializeFilters, weekendRange, type EventIndex } from '../../src/lib/calendar-filter.ts';
import { compareEvents } from '../../src/lib/event-order.ts';
import { calendar, escapeText, eventLines, foldLine } from '../../src/lib/ics.ts';
import { eventSchema } from '../../src/lib/schemas.ts';

const event = (change: Partial<EventIndex> = {}): EventIndex => ({
  date: '2026-12-05',
  text: fold('Žabácký cyklokros Sedlčany Středočeský kraj TBC série 2026'),
  region: 'stredocesky',
  series: ['tbc-serie-2026'],
  types: ['amateur', 'children', 'young'],
  ...change,
});
const allowed = { regions: ['stredocesky'], series: ['tbc-serie-2026'], types: ['amateur', 'young'] };

describe('search', () => {
  it('ignores Czech diacritics and case', () => {
    expect(fold('Příliš ŽLUŤOUČKÝ kůň')).toBe('prilis zlutoucky kun');
    for (const q of ['zabacky', 'ŽABÁCKÝ', 'sedlcany tbc', 'Středočeský']) expect(matches(event(), { ...emptyFilters, q }), q).toBe(true);
    expect(matches(event(), { ...emptyFilters, q: 'ostrava' })).toBe(false);
  });

  it('combines filters', () => {
    expect(matches(event(), { ...emptyFilters, region: 'stredocesky', series: 'tbc-serie-2026', type: 'young' })).toBe(true);
    expect(matches(event(), { ...emptyFilters, type: 'elite' })).toBe(false);
    expect(matches(event({ types: [] }), { ...emptyFilters, type: 'amateur' })).toBe(false);
  });

  it('applies a date range inclusively and never matches unconfirmed dates', () => {
    expect(matches(event(), { ...emptyFilters, from: '2026-12-05', to: '2026-12-05' })).toBe(true);
    expect(matches(event(), { ...emptyFilters, from: '2026-12-06' })).toBe(false);
    expect(matches(event({ date: null }), { ...emptyFilters, from: '2026-01-01' })).toBe(false);
    expect(matches(event({ date: '2026-12-05', endDate: '2026-12-06' }), { ...emptyFilters, from: '2026-12-06' })).toBe(true);
  });
});

describe('filter URLs', () => {
  it('round-trips valid filters', () => {
    const filters = { q: 'tábor', region: 'stredocesky', series: 'tbc-serie-2026', type: 'young', from: '2026-12-01', to: '2026-12-31' };
    expect(parseFilters(new URLSearchParams(serializeFilters(filters)), allowed)).toEqual(filters);
  });

  it('drops unknown and malformed values', () => {
    const parsed = parseFilters(new URLSearchParams('region=<script>&series=nope&type=elite&from=2026-13-45&to=yesterday&q=' + 'x'.repeat(200)), allowed);
    expect(parsed).toEqual({ ...emptyFilters, q: 'x'.repeat(80) });
  });
});

describe('dates', () => {
  it('finds the weekend from Friday to Sunday', () => {
    expect(weekendRange('2026-11-30')).toEqual({ from: '2026-12-04', to: '2026-12-06' }); // Monday
    expect(weekendRange('2026-12-04')).toEqual({ from: '2026-12-04', to: '2026-12-06' }); // Friday
    expect(weekendRange('2026-12-05')).toEqual({ from: '2026-12-05', to: '2026-12-06' }); // Saturday
    expect(weekendRange('2026-12-06')).toEqual({ from: '2026-12-06', to: '2026-12-06' }); // Sunday
    expect(weekendRange('2026-12-31')).toEqual({ from: '2027-01-01', to: '2027-01-03' }); // across New Year
  });

  it('treats an event as past only after its last day', () => {
    expect(isPast({ date: '2026-12-05' }, '2026-12-05')).toBe(false);
    expect(isPast({ date: '2026-12-05' }, '2026-12-06')).toBe(true);
    expect(isPast({ date: '2026-12-05', endDate: '2026-12-06' }, '2026-12-06')).toBe(false);
    expect(isPast({ date: null }, '2030-01-01')).toBe(false);
  });
});

const record = (change: Record<string, unknown> = {}) =>
  eventSchema.parse({
    id: 'sample-2026',
    slug: '2026-sample',
    seasonId: '2026-2027',
    name: { official: 'Velká cena; Tábor, finále' },
    timing: { precision: 'day', startDate: '2026-12-31' },
    location: { town: 'Tábor', venue: 'Areál Komora' },
    status: 'scheduled',
    verification: 'unverified',
    provenance: [{ url: 'https://example.com/a', checkedDate: '2026-11-13', facts: ['date'] }],
    updatedDate: '2026-11-13',
    feed: { sequence: 2, lastModified: '2026-11-13T12:00:00Z' },
    ...change,
  });
const url = 'https://cyclocross.cz/zavody/2026-sample/';

describe('ordering', () => {
  it('sorts chronologically across New Year with unconfirmed dates last', () => {
    const january = record({ id: 'b', slug: '2027-b', timing: { precision: 'day', startDate: '2027-01-02' } });
    const december = record({ id: 'a', timing: { precision: 'day', startDate: '2026-12-31' } });
    const unknown = record({ id: 'c', slug: '2026-c', timing: { precision: 'unknown' } });
    expect([unknown, january, december].sort(compareEvents).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('calendar files', () => {
  it('exports an all-day event with an exclusive end and a stable UID', () => {
    const lines = eventLines(record(), { url })!;
    expect(lines).toContain('UID:sample-2026@cyclocross.cz');
    expect(lines).toContain('DTSTART;VALUE=DATE:20261231');
    expect(lines).toContain('DTEND;VALUE=DATE:20270101');
    expect(lines).toContain('SEQUENCE:2');
    expect(lines).toContain('LAST-MODIFIED:20261113T120000Z');
    expect(lines).toContain('SUMMARY:Velká cena\; Tábor\\, finále');
  });

  it('exports a timed event in Prague time and never invents an end', () => {
    const lines = eventLines(record({ timing: { precision: 'day', startDate: '2027-03-28', startTime: '10:00' } }), { url })!;
    expect(lines).toContain('DTSTART;TZID=Europe/Prague:20270328T100000');
    expect(lines.some((line) => line.startsWith('DTEND'))).toBe(false);
    expect(calendar('x', [{ event: record({ timing: { precision: 'day', startDate: '2027-03-28', startTime: '10:00' } }), url }])).toContain('BEGIN:VTIMEZONE');
  });

  it('keeps the UID when an event moves and marks cancellations', () => {
    const moved = eventLines(record({ timing: { precision: 'day', startDate: '2027-01-09', previousDates: [{ startDate: '2026-12-31' }] }, feed: { sequence: 3, lastModified: '2026-12-01T08:00:00Z' } }), { url })!;
    expect(moved).toContain('UID:sample-2026@cyclocross.cz');
    expect(moved).toContain('SEQUENCE:3');
    expect(eventLines(record({ status: 'cancelled' }), { url })).toContain('STATUS:CANCELLED');
  });

  it('leaves events without a confirmed day out of the feed', () => {
    expect(eventLines(record({ status: 'postponed', timing: { precision: 'unknown' } }), { url })).toBeNull();
  });

  it('escapes text and folds long lines on character boundaries', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\;c\\,d\\ne');
    const folded = foldLine(`SUMMARY:${'ž'.repeat(60)}`);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replaceAll('\r\n ', '')).toBe(`SUMMARY:${'ž'.repeat(60)}`);
    expect(calendar('x', [{ event: record(), url }]).endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
