import { getCollection } from 'astro:content';
import { compareEvents } from './event-order.ts';
import type { EventRecord, SeriesRecord, SourceRecord, OrganiserRecord } from './schemas.ts';

export interface Dataset {
  events: EventRecord[];
  series: Map<string, SeriesRecord>;
  organisers: Map<string, OrganiserRecord>;
  sources: Map<string, SourceRecord>;
}

let cache: Promise<Dataset> | undefined;

export function loadDataset(): Promise<Dataset> {
  cache ??= (async () => {
    const [events, series, organisers, sources] = await Promise.all([
      getCollection('events'),
      getCollection('series'),
      getCollection('organisers'),
      getCollection('sources'),
    ]);
    const byId = <T extends { id: string }>(entries: { data: T }[]) => new Map(entries.map((entry) => [entry.data.id, entry.data]));
    return {
      events: events.map((entry) => entry.data).sort(compareEvents),
      series: byId(series),
      organisers: byId(organisers),
      sources: byId(sources),
    };
  })();
  return cache;
}
