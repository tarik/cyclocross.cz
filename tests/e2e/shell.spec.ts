import { expect, test } from '@playwright/test';

const pairs = [
  ['/', '/en/'],
  ['/o-projektu/', '/en/about/'],
  ['/prispet/', '/en/contribute/'],
  ['/reklama/', '/en/advertise/'],
  ['/soukromi/', '/en/privacy/'],
] as const;

for (const [cs, en] of pairs) {
  test(`${cs} and ${en} are language equivalents`, async ({ page }) => {
    await page.goto(cs);
    await expect(page.locator('html')).toHaveAttribute('lang', 'cs-CZ');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', new RegExp(`${en}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const menu = page.getByRole('button', { name: 'Menu' });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('link', { name: 'Switch to English' }).click();
    await expect(page).toHaveURL(new RegExp(`${en}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${en}$`));
  });
}

test('language switch keeps the query string and maps the section', async ({ page }) => {
  await page.goto('/?q=tabor#kalendar');
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Switch to English' }).click();
  await expect(page).toHaveURL(/\/en\/\?q=tabor#calendar$/);
});

test('skip link moves focus to the main content', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not tab to links by default');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Přeskočit na obsah' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('mobile menu opens, closes with Escape and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  const calendar = page.getByRole('navigation', { name: 'Hlavní navigace' }).getByRole('link', { name: 'Kalendář' });
  await expect(calendar).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(calendar).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(menu).toBeFocused();
});

test('no horizontal scrolling at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/', '/en/', '/o-projektu/']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('navigation and content are available', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Hlavní navigace' }).getByRole('link', { name: 'Kalendář' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kalendář závodů' })).toBeVisible();
  });
});

test('unknown paths get the bilingual 404 page', async ({ page }) => {
  const response = await page.goto('/tohle-neexistuje/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Stránka nenalezena' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
