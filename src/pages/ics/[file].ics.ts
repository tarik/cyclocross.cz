/**
 * Calendar files: one per event with a confirmed day, plus one subscription
 * feed per season. Event links in the files point to the Czech pages, the
 * default language.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { eventPath } from '../../i18n/routes.ts';
import { loadDataset } from '../../lib/events.ts';
import { calendar } from '../../lib/ics.ts';

export const getStaticPaths: GetStaticPaths = async () => {
  const { events } = await loadDataset();
  const dated = events.filter((event) => event.timing.precision === 'day' && event.timing.startDate);
  const seasons = [...new Set(events.map((event) => event.seasonId))];
  return [
    ...dated.map((event) => ({ params: { file: event.slug }, props: { name: event.name.official, events: [event] } })),
    ...seasons.map((season) => ({
      params: { file: `season-${season}` },
      props: { name: `cyclocross.cz ${season.replace('-', '–')}`, events: dated.filter((event) => event.seasonId === season) },
    })),
  ];
};

export const GET: APIRoute = ({ props, site }) => {
  const events = (props.events as Awaited<ReturnType<typeof loadDataset>>['events']).map((event) => ({
    event,
    url: new URL(eventPath(event.slug, 'cs'), site).href,
  }));
  return new Response(calendar(props.name as string, events), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
