import { defineConfig, devices } from '@playwright/test';

const port = 4321;

/**
 * Behavioural smoke tests run against the built static site in Chromium,
 * Firefox and WebKit. Screenshots for review are captured separately by
 * `npm run review:capture` and are never committed.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'off',
  },
  webServer: {
    // Tests run against the fictional fixtures with a pinned build date, so
    // they do not change when real event data does.
    command: `npx astro build --outDir dist-test && npx astro preview --outDir dist-test --port ${port} --ignore-lock`,
    env: { CONTENT_SET: 'fixtures', BUILD_TODAY: '2026-11-30', SITE_ENV: 'development' },
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
});
