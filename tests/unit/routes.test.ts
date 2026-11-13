import { describe, expect, it } from 'vitest';
import { equivalentFragment, equivalentPath, eventPath, locales, normaliseBase, staticRoutes, stripBase, withBase } from '../../src/i18n/routes.ts';
import { ui } from '../../src/i18n/ui.ts';

describe('route registry', () => {
  it('maps every static route to its counterpart in both directions', () => {
    for (const route of Object.values(staticRoutes)) {
      expect(equivalentPath(route.cs, 'en')).toBe(route.en);
      expect(equivalentPath(route.en, 'cs')).toBe(route.cs);
    }
  });

  it('maps event pages by slug', () => {
    expect(equivalentPath(eventPath('2026-tabor-example', 'cs'), 'en')).toBe('/en/events/2026-tabor-example/');
    expect(equivalentPath('/en/events/2026-tabor-example/', 'cs')).toBe('/zavody/2026-tabor-example/');
  });

  it('does not guess unknown paths', () => {
    expect(equivalentPath('/neznama-stranka/', 'en')).toBeNull();
    expect(equivalentPath('/zavody/', 'en')).toBeNull();
    expect(equivalentPath('/zavody/a/b/', 'en')).toBeNull();
  });

  it('never gives two routes the same path', () => {
    const paths = Object.values(staticRoutes).flatMap((route) => locales.map((locale) => route[locale]));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('maps homepage fragments', () => {
    expect(equivalentFragment('kalendar', 'en')).toBe('calendar');
    expect(equivalentFragment('calendar', 'cs')).toBe('kalendar');
    expect(equivalentFragment('nope', 'cs')).toBeNull();
  });
});

describe('base path', () => {
  it('normalises the configured base', () => {
    expect(normaliseBase(undefined)).toBe('');
    expect(normaliseBase('/')).toBe('');
    expect(normaliseBase('/cyclocross.cz')).toBe('/cyclocross.cz');
    expect(normaliseBase('/cyclocross.cz/')).toBe('/cyclocross.cz');
    expect(normaliseBase('cyclocross.cz')).toBe('/cyclocross.cz');
  });

  it('adds and removes the base', () => {
    expect(withBase('/en/', '/cyclocross.cz')).toBe('/cyclocross.cz/en/');
    expect(withBase('/en/', '')).toBe('/en/');
    expect(stripBase('/cyclocross.cz/en/', '/cyclocross.cz')).toBe('/en/');
    expect(stripBase('/cyclocross.cz', '/cyclocross.cz')).toBe('/');
    expect(stripBase('/cyclocross.cz-other/', '/cyclocross.cz')).toBe('/cyclocross.cz-other/');
    expect(stripBase('/en/', '')).toBe('/en/');
  });
});

describe('dictionaries', () => {
  it('have the same non-empty keys in both languages', () => {
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.cs).sort());
    for (const locale of locales) {
      for (const [key, value] of Object.entries(ui[locale])) expect(value.trim(), `${locale}:${key}`).not.toBe('');
    }
  });
});
