/**
 * Captures review screenshots of the built site into `.review/` (git-ignored).
 * The captures are shown to the owner in the conversation. They are never
 * committed and never attached to a PR (SPEC.md section 14).
 *
 * Usage: npm run build && npm run review:capture -- [--only /path/,/en/path/] [--label name]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const port = 4399;
const base = `http://localhost:${port}`;
const label = option('label') ?? 'capture';
const outDir = option('out') ?? join('.review', label);
const paths = option('only')?.split(',') ?? ['/', '/en/', '/o-projektu/', '/en/about/', '/404.html'];
const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'narrow', width: 320, height: 640 },
];

const server = spawn('npx', ['astro', 'preview', '--port', String(port), '--ignore-lock'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start. Run `npm run build` first.');
}

await waitForServer();
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const slug = path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home';
      const file = join(outDir, `${slug}.${viewport.name}-${viewport.width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await context.close();
  }
} finally {
  await browser.close();
  stop();
}
