/**
 * Calendar enhancement: filters with shareable URLs, in-place details and
 * regrouping by today's date in Europe/Prague, so a stale build never shows a
 * past race as upcoming.
 */
import { emptyFilters, isActive, isPast, matches, parseFilters, serializeFilters, weekendRange, type EventIndex, type Filters } from '../lib/calendar-filter.ts';

interface Strings {
  one: string;
  few: string;
  many: string;
  label: string;
  past: string;
  locale: string;
}

function pragueToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
}

function plural(count: number, strings: Strings): string {
  if (count === 1) return strings.one;
  if (strings.locale === 'cs' && count >= 2 && count <= 4) return strings.few;
  return strings.many;
}

export function initCalendar(root: HTMLElement): void {
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Strings;
  const form = root.querySelector<HTMLFormElement>('[data-filters]');
  const rows = [...root.querySelectorAll<HTMLElement>('tbody[data-event]')];
  const today = pragueToday();
  if (!form) return;

  const index = new Map<HTMLElement, EventIndex>(
    rows.map((row) => [
      row,
      {
        date: row.dataset.date || null,
        endDate: row.dataset.end || null,
        text: row.dataset.text ?? '',
        region: row.dataset.region ?? '',
        series: (row.dataset.series ?? '').split(' ').filter(Boolean),
        types: (row.dataset.types ?? '').split(' ').filter(Boolean),
      },
    ]),
  );

  // Regroup rows the build placed under "upcoming" whose day has since passed.
  const pastTable = root.querySelector<HTMLTableElement>('[data-table="past"]');
  const pastGroup = root.querySelector<HTMLElement>('[data-group="past"]');
  for (const row of root.querySelectorAll<HTMLElement>('[data-table="upcoming"] tbody[data-event]')) {
    if (!isPast(index.get(row)!, today) || !pastTable) continue;
    const firstPast = pastTable.querySelector('tbody');
    pastTable.insertBefore(row, firstPast);
    const badge = row.querySelector<HTMLElement>('[data-status="scheduled"]');
    if (badge) {
      badge.dataset.status = 'past';
      badge.classList.replace('text-ok', 'text-ink-soft');
      const label = badge.querySelector('[data-status-label]');
      if (label) label.textContent = strings.past;
      const mark = badge.querySelector('[aria-hidden]');
      if (mark) mark.textContent = '○';
    }
  }

  // In-place details.
  function setExpanded(row: HTMLElement, expanded: boolean) {
    const button = row.querySelector<HTMLButtonElement>('[data-expand]');
    const detail = row.querySelector<HTMLElement>('[data-detail]');
    if (!button || !detail) return;
    button.setAttribute('aria-expanded', String(expanded));
    detail.hidden = !expanded;
  }
  for (const row of rows) {
    const button = row.querySelector<HTMLButtonElement>('[data-expand]');
    const link = row.querySelector<HTMLElement>('[data-page-link]');
    if (!button) continue;
    button.hidden = false;
    if (link) link.hidden = true;
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      setExpanded(row, expanded);
      if (expanded) history.replaceState(null, '', `${location.pathname}${location.search}#${row.id}`);
    });
  }

  // Filters.
  const field = (name: keyof Filters) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const optionValues = (name: 'region' | 'series' | 'type') => [...(field(name) as HTMLSelectElement).options].map((option) => option.value).filter(Boolean);
  const allowed = { regions: optionValues('region'), series: optionValues('series'), types: optionValues('type') };
  const count = form.querySelector<HTMLElement>('[data-count]');
  const reset = form.querySelector<HTMLButtonElement>('[data-reset]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const weekend = weekendRange(today);

  const read = (): Filters => ({
    q: field('q').value.trim(),
    region: field('region').value,
    series: field('series').value,
    type: field('type').value,
    from: field('from').value,
    to: field('to').value,
  });
  const write = (filters: Filters) => {
    for (const key of Object.keys(filters) as (keyof Filters)[]) field(key).value = filters[key];
  };

  function apply(updateUrl: boolean) {
    const filters = read();
    const active = isActive(filters);
    const shown: Record<string, number> = { upcoming: 0, unconfirmed: 0, past: 0 };
    for (const row of rows) {
      const visible = matches(index.get(row)!, filters);
      row.hidden = !visible;
      const table = row.closest<HTMLElement>('[data-table]')?.dataset.table ?? 'upcoming';
      if (visible) shown[table] = (shown[table] ?? 0) + 1;
    }
    for (const group of root.querySelectorAll<HTMLElement>('[data-group]')) {
      const key = group.dataset.group!;
      if (key !== 'upcoming') group.hidden = shown[key] === 0;
      const groupCount = group.querySelector('[data-group-count]');
      if (groupCount) groupCount.textContent = `(${shown[key]})`;
      const table = group.querySelector<HTMLElement>('table');
      if (table && key === 'upcoming') table.hidden = shown.upcoming === 0;
    }
    if (empty) {
      empty.hidden = shown.upcoming > 0;
      empty.textContent = (active ? empty.dataset.emptyFiltered : empty.dataset.emptyDefault) ?? '';
    }
    // A search that only matches past dates should not look like "nothing found".
    if (pastGroup instanceof HTMLDetailsElement && active && shown.upcoming + shown.unconfirmed === 0 && shown.past > 0) pastGroup.open = true;

    const total = shown.upcoming + shown.unconfirmed + (active ? shown.past : 0);
    if (count) count.textContent = `${strings.label} ${total} ${plural(total, strings)}`;
    if (reset) reset.hidden = !active;
    const pressed: Record<string, boolean> = {
      weekend: filters.from === weekend.from && filters.to === weekend.to,
      amateur: filters.type === 'amateur',
      young: filters.type === 'young',
    };
    for (const button of form!.querySelectorAll<HTMLButtonElement>('[data-shortcut]')) {
      button.setAttribute('aria-pressed', String(pressed[button.dataset.shortcut!] ?? false));
    }
    if (updateUrl) {
      const query = serializeFilters(filters);
      history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    }
  }

  form.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', () => apply(true));
  form.addEventListener('reset', () => {
    // The reset event fires before the fields are cleared.
    setTimeout(() => {
      write(emptyFilters);
      apply(true);
      field('q').focus();
    });
  });
  for (const button of form.querySelectorAll<HTMLButtonElement>('[data-shortcut]')) {
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      const filters = read();
      if (button.dataset.shortcut === 'weekend') {
        filters.from = on ? weekend.from : '';
        filters.to = on ? weekend.to : '';
      } else {
        filters.type = on ? button.dataset.shortcut! : '';
      }
      write(filters);
      apply(true);
    });
  }

  write(parseFilters(new URLSearchParams(location.search), allowed));
  apply(false);

  // Open the event named in the URL fragment, now and when it changes.
  function openFromHash() {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (!(target instanceof HTMLElement) || !target.matches('tbody[data-event]') || !root.contains(target)) return;
    const group = target.closest('details');
    if (group) group.open = true;
    target.hidden = false;
    setExpanded(target, true);
    target.scrollIntoView();
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
}
