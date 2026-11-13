/**
 * Route registry. Every page that exists in both languages is listed here, so
 * language equivalents are looked up and never guessed from strings.
 */
export const locales = ['cs', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'cs';

export const htmlLang: Record<Locale, string> = { cs: 'cs-CZ', en: 'en' };

export const staticRoutes = {
  home: { cs: '/', en: '/en/' },
  about: { cs: '/o-projektu/', en: '/en/about/' },
  contribute: { cs: '/prispet/', en: '/en/contribute/' },
  advertise: { cs: '/reklama/', en: '/en/advertise/' },
  privacy: { cs: '/soukromi/', en: '/en/privacy/' },
} as const satisfies Record<string, Record<Locale, string>>;

export type StaticRouteKey = keyof typeof staticRoutes;
export type SupportingPageKey = Exclude<StaticRouteKey, 'home'>;

export const supportingPages = ['about', 'contribute', 'advertise', 'privacy'] as const satisfies readonly SupportingPageKey[];

/** Stable fragment IDs of homepage sections, per language. */
export const fragments = {
  upcoming: { cs: 'nejblizsi', en: 'upcoming' },
  calendar: { cs: 'kalendar', en: 'calendar' },
  directory: { cs: 'serie-a-poradatele', en: 'series-and-organisers' },
  contribute: { cs: 'zapojte-se', en: 'get-involved' },
} as const satisfies Record<string, Record<Locale, string>>;

export type FragmentKey = keyof typeof fragments;

const eventBase: Record<Locale, string> = { cs: '/zavody/', en: '/en/events/' };

/**
 * The sub-path the site is served under, without a trailing slash. Empty on
 * the real domain. The GitHub Pages preview sets it through `BASE_PATH`.
 */
export function normaliseBase(value: string | undefined): string {
  const trimmed = (value ?? '/').replace(/\/+$/, '');
  return trimmed === '' || trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const base = normaliseBase(import.meta.env?.BASE_URL);

/** Prefixes a root-relative path with the base. Every emitted link goes through here. */
export function withBase(path: string, prefix: string = base): string {
  return `${prefix}${path}`;
}

/** Removes the base from a request path, so it can be matched against the registry. */
export function stripBase(pathname: string, prefix: string = base): string {
  if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) return pathname.slice(prefix.length) || '/';
  return pathname;
}

export function routePath(key: StaticRouteKey, locale: Locale): string {
  return withBase(staticRoutes[key][locale]);
}

export function sectionPath(key: FragmentKey, locale: Locale): string {
  return `${routePath('home', locale)}#${fragments[key][locale]}`;
}

export function eventPath(slug: string, locale: Locale): string {
  return withBase(`${eventBase[locale]}${slug}/`);
}

/** Calendar files are language-neutral, so they live outside the translated routes. */
export function icsPath(slug: string): string {
  return withBase(`/ics/${slug}.ics`);
}

export function seasonFeedPath(seasonId: string): string {
  return withBase(`/ics/season-${seasonId}.ics`);
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'cs' ? 'en' : 'cs';
}

/**
 * Finds the equivalent of a path in another language. Returns `null` when the
 * path is not a known translated route, so callers can fall back to the hub.
 */
export function equivalentPath(pathname: string, target: Locale): string | null {
  const unprefixed = stripBase(pathname);
  const path = unprefixed.endsWith('/') ? unprefixed : `${unprefixed}/`;
  for (const [key, route] of Object.entries(staticRoutes)) {
    for (const locale of locales) {
      if (route[locale] === path) return routePath(key as StaticRouteKey, target);
    }
  }
  for (const locale of locales) {
    const base = eventBase[locale];
    if (path.startsWith(base)) {
      const slug = path.slice(base.length, -1);
      if (slug && !slug.includes('/')) return eventPath(slug, target);
    }
  }
  return null;
}

/** Maps a homepage fragment ID to its counterpart in the other language. */
export function equivalentFragment(fragment: string, target: Locale): string | null {
  for (const ids of Object.values(fragments)) {
    for (const locale of locales) {
      if (ids[locale] === fragment) return ids[target];
    }
  }
  return null;
}
