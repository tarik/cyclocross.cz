# Progress

Read this after `SPEC.md`. Update it in every PR.

## Delivery plan status (SPEC.md section 15)

| PR | Deliverable | Status |
| --- | --- | --- |
| 1 | Astro foundation, bilingual routes, schemas, CI, Playwright, deployment template | Merged |
| 2 | Calendar, event pages, directory, feeds, contribution forms, researched season data | In review |
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

## What exists after PR 2

- 30 researched races for 2026-2027 in `src/content/events/`, with series and sources. All are `unverified`.
- Homepage: next races, filterable calendar (table on desktop, cards on phones), series directory.
- Event pages in both languages, per-event `.ics` files and a season feed under `/ics/`.
- Issue Forms for adding and correcting a race and reporting a site problem.
- Styling is Tailwind 4.
- After the owner's screenshot review: collapsed filter, button-style actions, two-column details, sticky header, slim turf footer. See `docs/decisions.md`.

## Data gaps to close

- Propozice PDFs of the JANEV Cup rounds and standalone races were not read: categories, fees and timetables are missing.
- TBC pages for Strakonice, Hůrka and Veselí nad Lužnicí were empty when read.
- No series beyond JANEV Cup, TBC série and the World Cup found yet. Search again (Prague, Moravia, East Bohemia).
- Past races: check results links and whether each took place.
- `cyklokros.cz` and `tbcserie.cz` cannot be fetched directly from the agent sandbox; use the web fetch tool.

## Waiting on the owner

- Public contribution address and private advertising address (before contact routes are published).
- Review of the heading font specimen (Jersey 15 is provisional).
- Review of the researched calendar.
- Licence choices for code, artwork and data.
- DigitalOcean account and DNS access (before staging or launch).

## Known limitations

- Browser tests run locally in Chromium only; Firefox and WebKit run in CI.
- Event structured data (JSON-LD), organiser records and the daily rebuild are not done yet.
- No staging deployment exists yet.
- The daily rebuild workflow is not written yet; it needs the deployment target first.
