/**
 * Whole-dataset validation: schema checks per file plus the cross-record rules
 * a single-file schema cannot see (duplicates, broken references, demo data).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { collectionSchemas, type DataCollection, type EventRecord } from './schemas.ts';

export interface ValidationProblem {
  file: string;
  message: string;
}

export interface LoadedContent {
  events: EventRecord[];
  problems: ValidationProblem[];
}

interface Options {
  /** Directories that each contain `events/`, `series/` and so on. */
  roots: string[];
  /** Production builds reject records marked `demo: true`. */
  production: boolean;
}

const collections = Object.keys(collectionSchemas) as DataCollection[];

export function validateContent({ roots, production }: Options): LoadedContent {
  const problems: ValidationProblem[] = [];
  const records: Record<DataCollection, Map<string, { file: string; data: any }>> = {
    events: new Map(),
    organisers: new Map(),
    series: new Map(),
    sources: new Map(),
    sponsors: new Map(),
  };

  for (const root of roots) {
    for (const collection of collections) {
      const dir = join(root, collection);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).sort()) {
        if (!/\.ya?ml$/.test(name)) continue;
        const file = join(dir, name);
        let raw: unknown;
        try {
          raw = parse(readFileSync(file, 'utf8'));
        } catch (error) {
          problems.push({ file, message: `YAML does not parse: ${(error as Error).message}` });
          continue;
        }
        const result = collectionSchemas[collection].safeParse(raw);
        if (!result.success) {
          for (const issue of result.error.issues) {
            problems.push({ file, message: `${issue.path.join('.') || '(root)'}: ${issue.message}` });
          }
          continue;
        }
        const data = result.data as { id: string; demo: boolean };
        if (name.replace(/\.ya?ml$/, '') !== data.id) {
          problems.push({ file, message: `File name must match id "${data.id}"` });
        }
        const existing = records[collection].get(data.id);
        if (existing) {
          problems.push({ file, message: `Duplicate ${collection} id "${data.id}" (also in ${existing.file})` });
          continue;
        }
        if (production && data.demo) {
          problems.push({ file, message: 'Demo record is not allowed in a production build' });
        }
        records[collection].set(data.id, { file, data });
      }
    }
  }

  const slugs = new Map<string, string>();
  for (const { file, data } of records.events.values()) {
    const event = data as EventRecord;
    const clash = slugs.get(event.slug);
    if (clash) problems.push({ file, message: `Duplicate event slug "${event.slug}" (also in ${clash})` });
    slugs.set(event.slug, file);
    for (const ref of event.organiserIds) {
      if (!records.organisers.has(ref)) problems.push({ file, message: `Unknown organiser "${ref}"` });
    }
    for (const ref of event.seriesIds) {
      if (!records.series.has(ref)) problems.push({ file, message: `Unknown series "${ref}"` });
    }
    for (const item of event.provenance) {
      if (item.sourceId && !records.sources.has(item.sourceId)) {
        problems.push({ file, message: `Unknown source "${item.sourceId}"` });
      }
    }
  }
  for (const { file, data } of records.series.values()) {
    for (const ref of data.organiserIds as string[]) {
      if (!records.organisers.has(ref)) problems.push({ file, message: `Unknown organiser "${ref}"` });
    }
  }

  return { events: [...records.events.values()].map((entry) => entry.data as EventRecord), problems };
}
