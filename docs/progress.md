# Progress

Read this after `SPEC.md`. Update it in every PR.

## Delivery plan status (SPEC.md section 15)

| PR | Deliverable | Status |
| --- | --- | --- |
| 1 | Astro foundation, bilingual routes, schemas, CI, Playwright, deployment template | In review |
| 2 | Calendar, event pages, directory, feeds, contribution forms, researched season data | Not started |
| 3 | Typography, tokens, wordmark and cyclist proposals | Not started (font survey done, see decisions) |
| 4 | Eight-direction riding study, track geometry, background, soil transition | Not started |
| 5 | Supporting content, advertising placements, metadata | Not started |
| 6 | Animation controller and action modules | Not started |
| 7 | Full choreography, refined art, kits, responsive scenes | Not started |
| 8 | Performance, accessibility, operations, launch candidate | Not started |

## What exists after PR 1

- Bilingual shell: `/` and `/en/`, four supporting pages per language, bilingual 404, route registry in `src/i18n/routes.ts`, dictionaries in `src/i18n/ui.ts`.
- Content schemas in `src/lib/schemas.ts`, dataset validation in `src/lib/content-validation.ts`, fictional fixtures in `fixtures/`.
- The homepage shows a plain event list only to prove the data pipeline. The hero is a reserved-size placeholder, not artwork.
- Commands: `npm run dev`, `build`, `preview`, `check`, `check:content`, `test`, `test:e2e`, `review:capture`.
- CI in `.github/workflows/ci.yml`. Deployment template in `.do/app.yaml` (not provisioned, unverified).

## Waiting on the owner

- Public contribution address and private advertising address (before contact routes are published).
- Review of the heading font specimen (Jersey 15 is provisional).
- Licence choices for code, artwork and data.
- DigitalOcean account and DNS access (before staging or launch).

## Known limitations

- Browser tests ran locally in Chromium only; Firefox and WebKit run in CI.
- No staging deployment exists yet.
- The daily rebuild workflow is not written yet; it needs the deployment target first.
