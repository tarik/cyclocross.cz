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

export function routePath(key: StaticRouteKey, locale: Locale): string {
  return staticRoutes[key][locale];
}

export function sectionPath(key: FragmentKey, locale: Locale): string {
  return `${staticRoutes.home[locale]}#${fragments[key][locale]}`;
}

export function eventPath(slug: string, locale: Locale): string {
  return `${eventBase[locale]}${slug}/`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'cs' ? 'en' : 'cs';
}

/**
 * Finds the equivalent of a path in another language. Returns `null` when the
 * path is not a known translated route, so callers can fall back to the hub.
 */
export function equivalentPath(pathname: string, target: Locale): string | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const route of Object.values(staticRoutes)) {
    for (const locale of locales) {
      if (route[locale] === path) return route[target];
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
