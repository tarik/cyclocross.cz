import { expect, test } from '@playwright/test';

test('motion review plays, pauses, steps and jumps to a segment', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto('/review/motion/?seed=3');
  const readout = page.locator('[data-motion-readout]');
  await expect(readout).toContainText('Loop 1');

  const play = page.locator('[data-motion-play]');
  await play.click();
  await expect(play).toHaveText('Play');
  const paused = await readout.textContent();
  await page.waitForTimeout(300);
  await expect(readout).toHaveText(paused!);

  await page.locator('[data-motion-step="1"]').click();
  await expect(readout).not.toHaveText(paused!);

  await page.locator('[data-motion-seek="stairs"]').click();
  await expect(readout).toContainText('stairs · carry');
  await page.locator('[data-motion-seek="pose"]').click();
  await expect(readout).toContainText('pose · straddle W');

  const national = page.locator('[data-motion-kit="national"]');
  await national.click();
  await expect(readout).toContainText('national');
  await expect(national).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('motion review starts paused when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/review/motion/');
  await expect(page.locator('[data-motion-readout]')).toContainText('pose · straddle S');
  await expect(page.locator('[data-motion-play]')).toHaveText('Play');
});
