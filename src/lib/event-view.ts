/** Turns an event record into the localised values the templates need. */
import { regionName } from '../config/regions.ts';
import { site } from '../config/site.ts';
import { eventPath, icsPath, type Locale } from '../i18n/routes.ts';
import { ui, type UiKey } from '../i18n/ui.ts';
import { fold, isPast, type EventIndex } from './calendar-filter.ts';
import { formatEventDates } from './dates.ts';
import type { Dataset } from './events.ts';
import type { EventRecord } from './schemas.ts';

export type DisplayStatus = EventRecord['status'] | 'past';

export function displayStatus(event: EventRecord, today: string): DisplayStatus {
  // A scheduled event whose day has gone by is labelled by date only. It is
  // not called "completed" unless a source confirmed that it took place.
  if (event.status === 'scheduled' && isPast({ date: event.timing.startDate ?? null, endDate: event.timing.endDate }, today)) return 'past';
  return event.status;
}

export function eventView(event: EventRecord, locale: Locale, dataset: Dataset, today: string) {
  const t = (key: UiKey) => ui[locale][key];
  const series = event.seriesIds.map((id) => dataset.series.get(id)).filter((item) => item !== undefined);
  const region = regionName(event.location.regionId, locale);
  const types = event.participation?.types ?? [];
  const indexTypes: string[] = [...types];
  if (types.includes('youth') || types.includes('children')) indexTypes.push('young');
  const displayName = event.name.display?.[locale];
  const status = displayStatus(event, today);

  const index: EventIndex = {
    date: event.timing.startDate ?? null,
    endDate: event.timing.endDate ?? null,
    text: fold(
      [event.name.official, displayName, event.location.town, event.location.venue, regionName(event.location.regionId, 'cs'), regionName(event.location.regionId, 'en'), ...series.map((item) => item.name)]
        .filter(Boolean)
        .join(' '),
    ),
    region: event.location.regionId ?? '',
    series: event.seriesIds,
    types: indexTypes,
  };

  return {
    event,
    anchor: `e-${event.slug}`,
    name: event.name.official,
    displayName,
    dateLabel: event.timing.startDate ? formatEventDates(event.timing.startDate, event.timing.endDate, locale) : t('cal.unconfirmed'),
    time: event.timing.startTime,
    town: event.location.town,
    region,
    series,
    typeLabels: types.map((type) => t(`type.${type}` as UiKey)),
    status,
    statusLabel: t(`status.${status}` as UiKey),
    path: eventPath(event.slug, locale),
    ics: event.timing.precision === 'day' && event.timing.startDate ? icsPath(event.slug) : null,
    reportUrl: `${site.issuesUrl}/new?template=correct-event.yml&event=${encodeURIComponent(event.id)}`,
    index,
  };
}

export type EventView = ReturnType<typeof eventView>;
