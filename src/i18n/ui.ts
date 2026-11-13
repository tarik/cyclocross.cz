import type { Locale } from './routes.ts';

const cs = {
  'site.tagline': 'Cyklokros v Česku na jednom místě',
  'site.description':
    'Kalendář cyklokrosových závodů v Česku, praktické informace pro závodníky i diváky a odkazy na oficiální zdroje.',
  'skip.toContent': 'Přeskočit na obsah',
  'nav.label': 'Hlavní navigace',
  'nav.menu': 'Menu',
  'nav.calendar': 'Kalendář',
  'nav.directory': 'Série a pořadatelé',
  'nav.about': 'O projektu',
  'nav.contribute': 'Přispět',
  'lang.label': 'Jazyk',
  'lang.switchTo': 'Switch to English',
  'lang.current': 'Čeština',
  'hero.title': 'Cyklokros v Česku',
  'hero.lead': 'Závody pro elitu, amatéry i děti. Najděte ten svůj, ať už chcete startovat, nebo fandit u trati.',
  'hero.cta': 'Zobrazit kalendář',
  'home.upcoming.title': 'Příští závody',
  'home.calendar.title': 'Kalendář závodů',
  'home.directory.title': 'Série a pořadatelé',
  'home.contribute.title': 'Přidejte závod',
  'home.contribute.lead':
    'Chybí tu závod nebo se něco změnilo? Dejte nám vědět a doložte to odkazem na oficiální zdroj.',
  'home.contribute.cta': 'Jak přispět',
  'home.pending': 'Tuto část právě připravujeme.',
  'footer.label': 'Patička',
  'footer.independent':
    'cyclocross.cz je nezávislý projekt. Není oficiálním webem žádného svazu, série ani pořadatele.',
  'footer.pages': 'Další stránky',
  'footer.source': 'Zdrojový kód a hlášení chyb',
  'page.advertise': 'Reklama',
  'page.privacy': 'Soukromí',
  'page.about': 'O projektu',
  'page.contribute': 'Přispět',
  'notfound.title': 'Stránka nenalezena',
  'notfound.lead': 'Tahle trať nikam nevede. Zkuste to z hlavní stránky.',
  'notfound.home': 'Zpět na hlavní stránku',
  'env.notice': 'Vývojová verze. Data mohou být smyšlená.',
} as const;

export type UiKey = keyof typeof cs;

const en: Record<UiKey, string> = {
  'site.tagline': 'Cyclocross in Czechia in one place',
  'site.description':
    'A calendar of cyclocross races in Czechia, practical information for racers and spectators, and links to official sources.',
  'skip.toContent': 'Skip to content',
  'nav.label': 'Main navigation',
  'nav.menu': 'Menu',
  'nav.calendar': 'Calendar',
  'nav.directory': 'Series & organisers',
  'nav.about': 'About',
  'nav.contribute': 'Contribute',
  'lang.label': 'Language',
  'lang.switchTo': 'Přepnout do češtiny',
  'lang.current': 'English',
  'hero.title': 'Cyclocross in Czechia',
  'hero.lead': 'Races for elite riders, amateurs and children. Find yours, whether you want to start or cheer by the course.',
  'hero.cta': 'View the calendar',
  'home.upcoming.title': 'Upcoming races',
  'home.calendar.title': 'Race calendar',
  'home.directory.title': 'Series & organisers',
  'home.contribute.title': 'Add a race',
  'home.contribute.lead':
    'Is a race missing, or has something changed? Let us know and back it up with a link to an official source.',
  'home.contribute.cta': 'How to contribute',
  'home.pending': 'This section is being prepared.',
  'footer.label': 'Footer',
  'footer.independent':
    'cyclocross.cz is an independent project. It is not the official website of any federation, series or organiser.',
  'footer.pages': 'More pages',
  'footer.source': 'Source code and issue reports',
  'page.advertise': 'Advertise',
  'page.privacy': 'Privacy',
  'page.about': 'About',
  'page.contribute': 'Contribute',
  'notfound.title': 'Page not found',
  'notfound.lead': 'This course leads nowhere. Try again from the homepage.',
  'notfound.home': 'Back to the homepage',
  'env.notice': 'Development build. Data may be fictional.',
};

export const ui: Record<Locale, Record<UiKey, string>> = { cs, en };

export function useTranslations(locale: Locale) {
  return (key: UiKey): string => ui[locale][key];
}
