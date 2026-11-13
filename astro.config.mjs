import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// The canonical origin. Staging builds override it with SITE_URL.
const site = process.env.SITE_URL ?? 'https://cyclocross.cz';

// Only the GitHub Pages preview is served under a sub-path.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'cs',
    locales: ['cs', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: { plugins: [tailwindcss()] },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'cs', locales: { cs: 'cs-CZ', en: 'en' } },
      filter: (page) => !page.includes('/review/'),
    }),
  ],
});
