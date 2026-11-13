/**
 * Site-wide configuration. Values that the owner has not supplied yet stay
 * `null`; the interface must cope with that and never show an invented value.
 */
export type SiteEnv = 'development' | 'staging' | 'production';

const env = (process.env.SITE_ENV ?? 'development') as SiteEnv;

export const site = {
  name: 'cyclocross.cz',
  origin: 'https://cyclocross.cz',
  env,
  /** Staging and development builds must never be indexed. */
  indexable: env === 'production',
  activeSeason: '2026-2027',
  timezone: 'Europe/Prague',
  repositoryUrl: 'https://github.com/tarik/cyclocross.cz',
  issuesUrl: 'https://github.com/tarik/cyclocross.cz/issues',
  contact: {
    /** Public address for corrections and contributions. Owner input pending. */
    contributions: null as string | null,
    /** Private address for advertising enquiries. Owner input pending. */
    advertising: null as string | null,
  },
  features: {
    heroAnimation: false,
    advertising: false,
    analytics: false,
  },
} as const;
