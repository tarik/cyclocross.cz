# Decision log

Newest first. Each entry says what was decided, by whom and why. Owner decisions are binding; agent decisions are defaults that the owner can overturn.

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
