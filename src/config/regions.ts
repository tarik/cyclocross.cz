import type { Locale } from '../i18n/routes.ts';

/** Czech regions (kraje). IDs are stable and used in event data and filter URLs. */
export const regions = {
  praha: { cs: 'Praha', en: 'Prague' },
  stredocesky: { cs: 'Středočeský kraj', en: 'Central Bohemia' },
  jihocesky: { cs: 'Jihočeský kraj', en: 'South Bohemia' },
  plzensky: { cs: 'Plzeňský kraj', en: 'Plzeň Region' },
  karlovarsky: { cs: 'Karlovarský kraj', en: 'Karlovy Vary Region' },
  ustecky: { cs: 'Ústecký kraj', en: 'Ústí nad Labem Region' },
  liberecky: { cs: 'Liberecký kraj', en: 'Liberec Region' },
  kralovehradecky: { cs: 'Královéhradecký kraj', en: 'Hradec Králové Region' },
  pardubicky: { cs: 'Pardubický kraj', en: 'Pardubice Region' },
  vysocina: { cs: 'Kraj Vysočina', en: 'Vysočina Region' },
  jihomoravsky: { cs: 'Jihomoravský kraj', en: 'South Moravia' },
  olomoucky: { cs: 'Olomoucký kraj', en: 'Olomouc Region' },
  zlinsky: { cs: 'Zlínský kraj', en: 'Zlín Region' },
  moravskoslezsky: { cs: 'Moravskoslezský kraj', en: 'Moravia-Silesia' },
} as const satisfies Record<string, Record<Locale, string>>;

export type RegionId = keyof typeof regions;

export function regionName(id: string | undefined, locale: Locale): string | undefined {
  return id && id in regions ? regions[id as RegionId][locale] : undefined;
}
