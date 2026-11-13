import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { validateContent } from '../../src/lib/content-validation.ts';
import { eventSchema } from '../../src/lib/schemas.ts';
import { formatEventDate, todayInPrague } from '../../src/lib/dates.ts';

const base = {
  id: 'sample-2026',
  slug: '2026-sample',
  seasonId: '2026-2027',
  name: { official: 'Sample' },
  timing: { precision: 'day', startDate: '2026-12-05' },
  location: { town: 'Tábor' },
  status: 'scheduled',
  verification: 'unverified',
  provenance: [{ url: 'https://example.com/a', checkedDate: '2026-11-13', facts: ['date'] }],
  updatedDate: '2026-11-13',
  feed: { sequence: 0, lastModified: '2026-11-13T12:00:00Z' },
};
const withChange = (change: Record<string, unknown>) => ({ ...structuredClone(base), ...change });

describe('event schema', () => {
  it('accepts a minimal event and keeps unknowns absent', () => {
    const event = eventSchema.parse(base);
    expect(event.participation).toBeUndefined();
    expect(event.practical.fees).toBeUndefined();
    expect(event.timing.timezone).toBe('Europe/Prague');
  });

  it('accepts a postponed event with no replacement date', () => {
    const result = eventSchema.safeParse(
      withChange({ status: 'postponed', timing: { precision: 'unknown', previousDates: [{ startDate: '2027-01-09' }] } }),
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ['unsafe URL protocol', { links: { official: 'javascript:alert(1)' } }],
    ['invalid status', { status: 'maybe' }],
    ['impossible date', { timing: { precision: 'day', startDate: '2026-02-30' } }],
    ['end before start', { timing: { precision: 'day', startDate: '2026-12-05', endDate: '2026-12-04' } }],
    ['time without a day', { timing: { precision: 'month', startDate: '2026-12-01', startTime: '10:00' } }],
    ['missing provenance', { provenance: [] }],
    ['no town or region', { location: {} }],
    ['slug outside the season', { slug: '2024-sample' }],
    ['unknown field', { fee: 0 }],
    ['broken season', { seasonId: '2026-2028' }],
  ])('rejects %s', (_label, change) => {
    expect(eventSchema.safeParse(withChange(change)).success).toBe(false);
  });
});

describe('dataset validation', () => {
  function dataset(files: Record<string, unknown>) {
    const root = mkdtempSync(join(tmpdir(), 'cx-content-'));
    for (const [path, value] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), stringify(value));
    }
    return root;
  }

  it('passes the committed fixtures outside production', () => {
    expect(validateContent({ roots: ['src/content', 'fixtures'], production: false }).problems).toEqual([]);
  });

  it('rejects demo records in production', () => {
    const { problems } = validateContent({ roots: ['fixtures'], production: true });
    expect(problems.some((problem) => problem.message.includes('Demo record'))).toBe(true);
  });

  it('reports broken references, duplicate slugs and mismatched file names', () => {
    const root = dataset({
      'events/sample-2026.yaml': withChange({ seriesIds: ['missing-series'] }),
      'events/other-2026.yaml': withChange({ id: 'other-2026', organiserIds: ['missing-club'] }),
      'events/wrong-name.yaml': withChange({ id: 'third-2026', slug: '2026-third' }),
    });
    const messages = validateContent({ roots: [root], production: true }).problems.map((problem) => problem.message);
    expect(messages).toContain('Unknown series "missing-series"');
    expect(messages).toContain('Unknown organiser "missing-club"');
    expect(messages.some((message) => message.startsWith('Duplicate event slug "2026-sample"'))).toBe(true);
    expect(messages).toContain('File name must match id "third-2026"');
  });
});

describe('dates', () => {
  it('formats event dates as written, in both languages', () => {
    expect(formatEventDate('2026-12-05', 'cs')).toBe('so 5. prosince 2026');
    expect(formatEventDate('2027-01-01', 'en')).toBe('Fri, 1 January 2027');
  });

  it('uses the Prague calendar day, including across midnight and DST', () => {
    expect(todayInPrague(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(todayInPrague(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(todayInPrague(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });
});
