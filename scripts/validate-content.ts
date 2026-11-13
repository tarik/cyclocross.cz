/**
 * Validates all content data. Run with `npm run check:content`.
 * Real data and fixtures are checked as two separate sets.
 */
import { validateContent } from '../src/lib/content-validation.ts';

const production = process.env.SITE_ENV === 'production';
let failed = false;

function check(label: string, roots: string[], rejectDemo: boolean) {
  const { events, problems } = validateContent({ roots, production: rejectDemo });
  if (problems.length > 0) {
    failed = true;
    console.error(`${label}: ${problems.length} problem(s)`);
    for (const problem of problems) console.error(`  ${problem.file}: ${problem.message}`);
  } else {
    console.log(`${label}: valid, ${events.length} event(s).`);
  }
}

// Real data must never contain demo records. Fixtures are a separate, self-contained set.
check('src/content', ['src/content'], true);
if (!production) check('fixtures', ['fixtures'], false);
if (failed) process.exit(1);
