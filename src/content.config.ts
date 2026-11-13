import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { eventSchema, organiserSchema, seriesSchema, sourceSchema, sponsorSchema } from './lib/schemas.ts';

/**
 * Editorial data lives in `src/content/`. Clearly fictional fixtures live in
 * `fixtures/` and are loaded only outside production, so previews and tests
 * have something to render before real data exists.
 */
const production = process.env.SITE_ENV === 'production';

function data(name: string) {
  const pattern = '*.{yaml,yml}';
  return glob({
    pattern: production ? `src/content/${name}/${pattern}` : `{src/content,fixtures}/${name}/${pattern}`,
    base: '.',
    generateId: ({ data }) => String(data.id),
  });
}

export const collections = {
  events: defineCollection({ loader: data('events'), schema: eventSchema }),
  organisers: defineCollection({ loader: data('organisers'), schema: organiserSchema }),
  series: defineCollection({ loader: data('series'), schema: seriesSchema }),
  sources: defineCollection({ loader: data('sources'), schema: sourceSchema }),
  sponsors: defineCollection({ loader: data('sponsors'), schema: sponsorSchema }),
  pages: defineCollection({
    loader: glob({ pattern: '*.md', base: 'src/content/pages' }),
    schema: z.object({
      page: z.enum(['about', 'contribute', 'advertise', 'privacy']),
      locale: z.enum(['cs', 'en']),
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  }),
};
