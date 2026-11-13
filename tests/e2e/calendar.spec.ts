import { expect, test, type Page } from '@playwright/test';

// The fixture site is built as of Monday 2026-11-30 (see playwright.config.ts).
const buildDay = new Date('2026-11-30T09:00:00+01:00');

async function open(page: Page, path: string, now = buildDay) {
  await page.clock.setFixedTime(now);
  await page.goto(path);
}
const upcoming = (page: Page) => page.locator('[data-table="upcoming"] tbody[data-event]:visible');
const past = (page: Page) => page.locator('[data-table="past"] tbody[data-event]');

test('groups races into upcoming, unconfirmed and past, in date order across New Year', async ({ page }) => {
  await open(page, '/');
  await expect(upcoming(page).locator('th')).toHaveText([/Příliš žluťoučký kůň/, /zrušený/, /novoroční/]);
  await expect(page.locator('[data-table="unconfirmed"] tbody[data-event] th')).toHaveText([/odložený/]);
  await expect(past(page)).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('Zobrazeno: 4 závody');
});

test('status is given in words, including cancelled and postponed races', async ({ page }) => {
  await open(page, '/');
  await expect(page.locator('#e-2026-cancelled-example [data-cell="status"]')).toContainText('Zrušeno');
  await expect(page.locator('#e-2027-postponed-example [data-cell="status"]')).toContainText('Odloženo');
});

test('search ignores diacritics and the filter survives a reload', async ({ page }) => {
  await open(page, '/');
  await page.getByLabel('Hledat').fill('rericha');
  await expect(upcoming(page)).toHaveCount(1);
  await expect(upcoming(page).locator('th')).toContainText('Řeřicha');
  await expect(page.getByRole('status')).toHaveText('Zobrazeno: 1 závod');
  await expect(page).toHaveURL(/\?q=rericha/);
  await page.reload();
  await expect(page.getByLabel('Hledat')).toHaveValue('rericha');
  await expect(upcoming(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Zrušit filtry' }).click();
  await expect(upcoming(page)).toHaveCount(3);
  await expect(page).not.toHaveURL(/\?/);
});

test('an empty result is explained and a past-only match is revealed', async ({ page }) => {
  await open(page, '/?q=nic-takoveho');
  await expect(page.getByText('Žádný závod neodpovídá zvoleným filtrům.')).toBeVisible();
  await page.getByLabel('Hledat').fill('proběhlý');
  await expect(past(page).first()).toBeVisible();
});

test('"this weekend" selects Friday to Sunday of the current week', async ({ page }) => {
  await open(page, '/');
  const shortcut = page.getByRole('button', { name: 'Tento víkend' });
  await shortcut.click();
  await expect(shortcut).toHaveAttribute('aria-pressed', 'true');
  await expect(upcoming(page).locator('th')).toHaveText([/Příliš žluťoučký kůň/]);
  await expect(page).toHaveURL(/from=2026-12-04&to=2026-12-06/);
});

test('ignores tampered filter values in the URL', async ({ page }) => {
  await open(page, '/?region=%3Cscript%3E&type=nonsense&from=tomorrow');
  await expect(upcoming(page)).toHaveCount(3);
  await expect(page.getByLabel('Kraj')).toHaveValue('');
});

test('details open in place from the keyboard and get a shareable address', async ({ page }) => {
  await open(page, '/');
  const row = page.locator('#e-2026-tabor-example');
  const button = row.getByRole('button', { name: /Podrobnosti/ });
  await button.focus();
  await expect(row.locator('[data-detail]')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(row.locator('[data-detail]')).toBeVisible();
  await expect(row.locator('[data-detail]')).toContainText('Smyšlený údaj. Závod neexistuje.');
  await expect(page).toHaveURL(/#e-2026-tabor-example$/);

  await open(page, '/#e-2027-postponed-example');
  await expect(page.locator('#e-2027-postponed-example [data-detail]')).toBeVisible();
  await expect(page.locator('#e-2027-postponed-example [data-detail]')).toContainText('Původní termín');
});

test('a stale build never shows a past race as upcoming', async ({ page }) => {
  await open(page, '/', new Date('2026-12-10T09:00:00+01:00'));
  await expect(upcoming(page).locator('th')).toHaveText([/zrušený/, /novoroční/]);
  await expect(past(page)).toHaveCount(2);
  await page.locator('details[data-group="past"] summary').click();
  await expect(page.locator('#e-2026-tabor-example [data-cell="status"]')).toContainText('Termín proběhl');
  await expect(page.locator('[data-upcoming] li:visible h3')).toHaveText([/zrušený/, /novoroční/]);
});

test('switching language keeps the filter and the section', async ({ page }) => {
  await open(page, '/?series=demo-cup#kalendar');
  await expect(upcoming(page)).toHaveCount(1);
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/\?series=demo-cup#calendar$/);
  await expect(page.getByRole('combobox', { name: 'Series' })).toHaveValue('demo-cup');
  await expect(upcoming(page)).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('Showing: 1 race');
});

test('event pages are language equivalents and label Czech-only text', async ({ page }) => {
  await open(page, '/zavody/2027-new-year-example/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Řeřicha');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/events\/2027-new-year-example\/$/);
  await open(page, '/en/events/2027-new-year-example/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('This text is available in Czech only.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registration' })).toHaveAttribute('href', 'https://example.com/entry');
});

test('calendar files keep identity and report cancellations', async ({ request }) => {
  const single = await request.get('/ics/2026-tabor-example.ics');
  expect(single.headers()['content-type']).toContain('text/calendar');
  const body = await single.text();
  expect(body).toContain('UID:demo-tabor-example-2026@cyclocross.cz');
  expect(body).toContain('DTSTART;TZID=Europe/Prague:20261205T100000');

  const feed = await (await request.get('/ics/season-2026-2027.ics')).text();
  expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect(feed).toContain('STATUS:CANCELLED');
  expect(feed).not.toContain('demo-postponed-example-2027');
  expect((await request.get('/ics/2027-postponed-example.ics')).status()).toBe(404);
});

test('cards do not scroll sideways on a phone or at 320 px', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page, '/');
    await page.locator('#e-2026-tabor-example').getByRole('button', { name: /Podrobnosti/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${width}px`).toBeLessThanOrEqual(0);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every race is listed with a link to its page and official details', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('search')).toBeHidden();
    const link = page.locator('#e-2026-tabor-example').getByRole('link', { name: /Podrobnosti/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/zavody\/2026-tabor-example\/$/);
    await expect(page.getByRole('link', { name: 'Oficiální stránka závodu' })).toHaveAttribute('href', 'https://example.com/race');
  });
});
