# Decision log

Newest first. Each entry says what was decided, by whom and why. Owner decisions are binding; agent decisions are defaults that the owner can overturn.

## 2026-11-13, art proposals PR

- **Agent: sprites are drawn from a posable model, not frame by frame.** `art/rider.mjs` describes bicycle and rider in model units; `art/lib/raster.mjs` projects it for a facing direction and rasterises it with a depth buffer, a three-step shade and an outside-only outline. One model gives every direction the same proportions, wheel centres and ground anchor (SPEC.md 5.3). Hand-finished pixels can be layered on after the direction is approved.
- **Agent: kits are palette swaps** (`art/palettes.mjs`). Materials are named ramps, a kit replaces jersey, helmet and frame ramps.
- **Agent: the camera pitch is 18 degrees** for the proposals. To be confirmed with the track study.
- **Agent: generated sheets are committed in `public/art/`** because the site serves them. A unit test regenerates them and fails if they differ from the source.
- **Agent: review pages live under `/review/`** and are not built for production. They are also left out of the sitemap.
- **Agent: Czech race photographs are not yet on the reference board.** Wikimedia Commons could not be reached from the build environment and no link was guessed. See `docs/art-references.md`.

## 2026-11-13, calendar PR, owner review of screenshots

- **Owner: a development preview is published on GitHub Pages.** `.github/workflows/pages-preview.yml` builds `main` with `SITE_ENV=staging` under the sub-path `/cyclocross.cz/`, so it carries the development notice and `noindex`. This is not the production release; hosting for the real domain is still open. The sub-path comes from `BASE_PATH` and is applied only in the route registry (`withBase`, `stripBase`), so every internal link must come from `src/i18n/routes.ts`.
- **Owner: the filter is hidden by default.** A "Filtr" button opens the fields. The three shortcuts, the reset and the count stay visible. A dot on the button marks an active hidden filter, and a link that carries a filter opens the panel.
- **Owner: actions are buttons, not text links.** Official page, registration, regulations, results, calendar file, series links and the contribute actions use `.pill`; one primary action per group uses `.pill-primary`. Text links remain for sources and for the error report.
- **Owner: details are restructured to remove empty space.** One "Kde" line, then "Pro závodníky" and "Pro diváky" side by side with the programme, then the buttons, then one small line with sources, check date and the unverified note. A column with no data is not rendered.
- **Owner: the header stays fixed at the top** and the footer no longer repeats the navigation. The footer is a slim soil band with a pixel turf edge and three links (advertising, privacy, GitHub). A fuller pixel-art footer can follow with the art track.
- **Owner: the wordmark is one colour**, ".cz" in black.
- **Owner: the menu button on small screens is an icon without text** (accessible name "Menu"). The owner will judge the phone header again once the animation exists.
- **Agent: the row control "Podrobnosti" is a small bordered button** aligned on the status baseline.

## 2026-11-13, calendar PR

- **Owner: use Tailwind.** Tailwind 4 through its Vite plugin. Tokens live in `@theme` in `src/styles/global.css`; components use utilities in markup. A small `@layer components` holds what repeats (`.wrap`, `.button`, `.control`, `.chip`) and the two pieces that are not expressible as utilities (the stepped sky and ground).
- **Agent: a build uses real data or fixtures, never both.** `CONTENT_SET=fixtures` switches to the fictional set. Browser tests always use fixtures with `BUILD_TODAY=2026-11-30`, so they do not change when the calendar does.
- **Agent: a past race is labelled "Termín proběhl" / "Date has passed", not "completed".** `completed` is reserved for races a source confirms took place. Researched races keep `status: scheduled`.
- **Agent: researched races are `verification: unverified`** and every detail view says the organiser has not confirmed the data. The owner decides when a race counts as verified.
- **Agent: without JavaScript the calendar lists every race with a link to its page.** Filters and in-place details are enhancements. The table becomes cards below 960 px and keeps explicit ARIA table roles.
- **Agent: "This weekend" means Friday to Sunday**, so a Friday evening World Cup round is included.
- **Agent: "Children and youth" is one filter value** matching the `youth` and `children` participation types.
- **Agent: no season filter yet.** There is one season. Add the control when a second season has data.
- **Agent: calendar files live at `/ics/{slug}.ics` and `/ics/season-{season}.ics`**, outside the translated routes. Timed races without a known end have no `DTEND`. Races without a confirmed day are left out of the feed.
- **Agent: World Cup rounds carry the classification text "UCI World Cup"**, as the sources say, and no UCI class code.
- **Agent: map links go to OpenStreetMap** when a source gives coordinates. No map is embedded.
- **Agent: region left empty for Holé Vrchy and Hůrka** because no source read so far states it.

## 2026-11-13

- **Owner: the implementing agent draws all pixel art.** Original work, iterated in the browser.
- **Owner: the repository is public.** Issue Forms will live in this repository.
- **Owner: the initial calendar is researched from public sources** by the agent (UCI races in Ostrava and Tábor, cyklokros.cz series, TBC série, plus anything else it finds), with provenance, then reviewed by the owner.
- **Owner: do not commit screenshots.** Visual regression compares against a base-branch build made in the same run. Review captures go to `.review/`, which is git-ignored.
- **Owner: fonts must be self-hosted** so the site looks the same on every device. No system font as the body face.
- **Agent: Jersey 15 replaces Pixelify Sans as the provisional heading font.** In a rendered Czech specimen, Pixelify Sans draws `C` almost like `O`, `Z` like `2` and `5` like `S`, which is unacceptable for a site whose language switch reads "CZ". Of 19 pixel fonts checked, 14 cover all Czech letters; the Jersey family (10, 15, 20, 25) was the most legible with correct `ď` and `ť`. Silkscreen, DotGothic16, Sixtyfour and Workbench lack Czech glyphs. Press Start 2P covers them but with cramped capital accents. The final choice still needs the owner's review of the specimen (PR 3).
- **Agent: Inter (variable, self-hosted) is the provisional body font.** Full Czech coverage, OFL licence. Final choice in PR 3.
- **Agent: site track before art track.** The calendar PR moved ahead of the art PRs so art approvals never block it (SPEC.md section 15).
- **Agent: homepage fragment IDs are localised** (`#kalendar` / `#calendar`) and mapped through the route registry, so links read naturally in each language and the language switch keeps the section.
- **Agent: fictional fixtures live in `fixtures/`, outside `src/content/`.** They are loaded only when `SITE_ENV` is not `production`, and a production validation fails on any `demo: true` record.
- **Agent: the navigation collapses into a menu below 960 px.** At 768 px the four links plus the language switch do not fit on one row beside the wordmark.
- **Agent: Astro 7.4, plain CSS, no UI framework.** `astro preview` needs `--ignore-lock` when started by Playwright, because it otherwise detaches into the background.
