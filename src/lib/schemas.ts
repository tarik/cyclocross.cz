/**
 * Content schemas (SPEC.md section 7). Shared by Astro content collections and
 * by the standalone validator in `scripts/validate-content.ts`.
 *
 * Conventions: an absent value means "unknown". It never means "no", "none"
 * or zero. Do not add defaults that turn an unknown into a claimed fact.
 */
import { z } from 'astro/zod';

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = z.string().regex(idPattern, 'Use lowercase letters, digits and single hyphens');
/**
 * YAML parsers disagree about unquoted dates: some return a string, some a
 * Date. Both are accepted so editors do not have to remember to quote them.
 */
const isoDate = z.preprocess(
  (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, 'Not a real calendar date'),
);
const isoDateTime = z.preprocess(
  (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : value),
  z.iso.datetime(),
);
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const seasonId = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Use YYYY-YYYY')
  .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1, 'A season spans two consecutive years');

/** Only http(s) links are publishable; this rejects javascript:, data: and similar. */
export const safeUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}, 'Must be an absolute http(s) URL');

/** Text in one or both languages. Missing languages are labelled in the interface, not auto-filled. */
const localized = z.object({ cs: z.string().min(1).optional(), en: z.string().min(1).optional() }).strict();

export const eventStatus = z.enum(['scheduled', 'postponed', 'cancelled', 'completed']);
export const verificationState = z.enum(['unverified', 'verified']);
export const translationStatus = z.enum(['none', 'machine', 'reviewed']);
export const datePrecision = z.enum(['day', 'month', 'season', 'unknown']);
export const participationType = z.enum(['elite', 'amateur', 'masters', 'juniors', 'youth', 'children']);

const provenance = z
  .object({
    sourceId: id.optional(),
    url: safeUrl,
    checkedDate: isoDate,
    /** Which fact or fact group this evidence supports, for example "date" or "registration". */
    facts: z.array(z.string().min(1)).min(1),
    note: z.string().min(1).optional(),
  })
  .strict();

const timing = z
  .object({
    precision: datePrecision,
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    startTime: localTime.optional(),
    endTime: localTime.optional(),
    timezone: z.literal('Europe/Prague').default('Europe/Prague'),
    /** Earlier confirmed dates of a rescheduled event, oldest first. */
    previousDates: z.array(z.object({ startDate: isoDate, endDate: isoDate.optional(), note: z.string().optional() }).strict()).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.precision === 'day' && !value.startDate) {
      ctx.addIssue({ code: 'custom', message: 'A day-precision event needs startDate', path: ['startDate'] });
    }
    if (value.precision === 'unknown' && value.startDate) {
      ctx.addIssue({ code: 'custom', message: 'An unknown-date event must not carry startDate', path: ['startDate'] });
    }
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({ code: 'custom', message: 'endDate is before startDate', path: ['endDate'] });
    }
    if ((value.startTime || value.endTime) && value.precision !== 'day') {
      ctx.addIssue({ code: 'custom', message: 'Times need a day-precision date', path: ['startTime'] });
    }
    if (value.endTime && !value.startTime) {
      ctx.addIssue({ code: 'custom', message: 'endTime needs startTime', path: ['endTime'] });
    }
  });

export const eventSchema = z
  .object({
    id,
    /** Season-qualified and permanent, for example `2026-tabor-example`. */
    slug: z.string().regex(/^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Start with the year, for example 2026-town-name'),
    seasonId,
    recurringEventId: id.optional(),
    /** Fictional record for tests and previews. Rejected in production builds. */
    demo: z.boolean().default(false),
    name: z.object({ official: z.string().min(1), display: localized.optional() }).strict(),
    timing,
    location: z
      .object({
        town: z.string().min(1).optional(),
        regionId: id.optional(),
        country: z.string().length(2).default('CZ'),
        venue: z.string().min(1).optional(),
        address: z.string().min(1).optional(),
        coordinates: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).strict().optional(),
        mapUrl: safeUrl.optional(),
      })
      .strict(),
    organiserIds: z.array(id).default([]),
    seriesIds: z.array(id).default([]),
    /** Sporting classification, for example UCI C1. It says nothing about who may enter. */
    classifications: z.array(z.object({ body: z.string().min(1), code: z.string().min(1) }).strict()).default([]),
    /** Omit entirely when eligibility is unknown. */
    participation: z
      .object({
        types: z.array(participationType).min(1),
        eligibilityNotes: localized.optional(),
        categories: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .optional(),
    status: eventStatus,
    verification: verificationState,
    statusHistory: z.array(z.object({ date: isoDate, status: eventStatus, note: localized.optional() }).strict()).default([]),
    summary: localized.optional(),
    details: localized.optional(),
    translation: z.object({ en: translationStatus }).strict().default({ en: 'none' }),
    practical: z
      .object({
        registrationDeadline: isoDate.optional(),
        /** Only verified amounts. An unknown fee is omitted, never zero. */
        fees: z.array(z.object({ amount: z.number().nonnegative(), currency: z.string().length(3), label: localized.optional() }).strict()).optional(),
        feeNote: localized.optional(),
        timetable: z.array(z.object({ time: localTime, label: localized }).strict()).optional(),
        spectatorNotes: localized.optional(),
        accessibilityNotes: localized.optional(),
      })
      .strict()
      .default({}),
    links: z
      .object({ official: safeUrl.optional(), regulations: safeUrl.optional(), registration: safeUrl.optional(), results: safeUrl.optional() })
      .strict()
      .default({}),
    provenance: z.array(provenance).min(1),
    updatedDate: isoDate,
    /** Calendar feed revision. Increase `sequence` when a subscriber-visible fact changes. */
    feed: z.object({ sequence: z.number().int().nonnegative(), lastModified: isoDateTime }).strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.slug.startsWith(`${value.seasonId.slice(0, 4)}-`) && !value.slug.startsWith(`${value.seasonId.slice(5)}-`)) {
      ctx.addIssue({ code: 'custom', message: 'slug year must belong to seasonId', path: ['slug'] });
    }
    if (!value.location.town && !value.location.regionId) {
      ctx.addIssue({ code: 'custom', message: 'A published event needs a town or region', path: ['location'] });
    }
  });

export const organiserSchema = z
  .object({
    id,
    demo: z.boolean().default(false),
    name: z.string().min(1),
    description: localized.optional(),
    website: safeUrl.optional(),
    calendarUrl: safeUrl.optional(),
    /** Only a contact the organiser has published and approved for listing. */
    publicContact: z.string().min(1).optional(),
  })
  .strict();

export const seriesSchema = z
  .object({
    id,
    demo: z.boolean().default(false),
    name: z.string().min(1),
    seasonIds: z.array(seasonId).min(1),
    organiserIds: z.array(id).default([]),
    description: localized.optional(),
    website: safeUrl.optional(),
    calendarUrl: safeUrl.optional(),
    scope: localized.optional(),
  })
  .strict();

export const sourceSchema = z
  .object({
    id,
    demo: z.boolean().default(false),
    name: z.string().min(1),
    url: safeUrl,
    type: z.enum(['organiser', 'series', 'federation', 'uci', 'media', 'other']),
  })
  .strict();

export const sponsorSchema = z
  .object({
    id,
    demo: z.boolean().default(false),
    displayName: z.string().min(1),
    label: localized,
    description: localized,
    destination: safeUrl,
    placementIds: z.array(z.enum(['partner-footer', 'calendar-rail', 'section-sponsor', 'hero-sponsor'])).min(1),
    assets: z.record(z.string(), z.string().min(1)).default({}),
    campaign: z.object({ startDate: isoDate, endDate: isoDate }).strict(),
    visible: z.boolean(),
  })
  .strict();

export type EventRecord = z.infer<typeof eventSchema>;
export type OrganiserRecord = z.infer<typeof organiserSchema>;
export type SeriesRecord = z.infer<typeof seriesSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export type SponsorRecord = z.infer<typeof sponsorSchema>;

export const collectionSchemas = {
  events: eventSchema,
  organisers: organiserSchema,
  series: seriesSchema,
  sources: sourceSchema,
  sponsors: sponsorSchema,
} as const;
export type DataCollection = keyof typeof collectionSchemas;
