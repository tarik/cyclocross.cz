/**
 * Validates all content data. Run with `npm run check:content`.
 * Fixtures are included unless SITE_ENV=production, where any demo record fails.
 */
import { validateContent } from '../src/lib/content-validation.ts';

const production = process.env.SITE_ENV === 'production';
const roots = production ? ['src/content'] : ['src/content', 'fixtures'];
const { events, problems } = validateContent({ roots, production });

if (problems.length > 0) {
  console.error(`Content validation failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem.file}: ${problem.message}`);
  process.exit(1);
}
console.log(`Content is valid: ${events.length} event(s) from ${roots.join(', ')}.`);
